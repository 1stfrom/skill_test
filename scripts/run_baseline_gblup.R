#!/usr/bin/env Rscript

suppressPackageStartupMessages({
  library(data.table)
  library(readxl)
  library(rrBLUP)
})

# Purpose:
#   Build a genotype-only GBLUP baseline for the 2023 BGEM UAV-for-GS project.
#
# Inputs:
#   - Plot-level/manual phenotype workbook.
#   - BGEM imputed VCF on HCC shared storage.
#
# HCC path record:
#   Project checkout used on HCC:
#     /mnt/nrdstor/jyanglab/nathanma/projects/UAV-for-GS
#   Shared BGEM data location resolved through largedata/genotype/BGEM:
#     /mnt/nrdstor/jyanglab/shared/maize/BGEM
#   This script is normally launched by slurm-scripts/baseline_gblup.sh with
#   absolute paths derived from PROJECT_ROOT.
#
# Outputs:
#   - Genotype x nitrogen trait means used as baseline targets.
#   - Matched phenotype/genotype sample inventory.
#   - Genomic relationship matrix built directly from VCF genotypes.
#   - Cross-validation predictions and accuracy summaries.
#
# Notes:
#   This is a first HCC-ready baseline. It deliberately uses genotype-only
#   predictors and does not include UAV vegetation-index features.

parse_args <- function() {
  args <- commandArgs(trailingOnly = TRUE)
  values <- list(
    phenotype_file = "data/2023_BGEM_pheno_transformed_raw.xlsx",
    phenotype_sheet = 1,
    vcf_file = "largedata/genotype/BGEM/BGEM_hybrid_inbred_genotype.imputed.vcf.gz",
    outdir = "cache/gs_baseline_gblup",
    traits = "ear_weight,TKW,20KW,CW,cob_len_cm,cob_dia_mm",
    nitrogen_levels = "High N,Low N",
    folds = 5,
    seeds = "20260522",
    maf = 0.01,
    max_missing = 0.20,
    max_markers = 0,
    min_genotypes = 40
  )

  if (length(args) == 0) {
    return(values)
  }
  if (length(args) %% 2 != 0) {
    stop("Arguments must be supplied as --name value pairs.", call. = FALSE)
  }
  keys <- args[seq(1, length(args), by = 2)]
  vals <- args[seq(2, length(args), by = 2)]
  for (i in seq_along(keys)) {
    key <- sub("^--", "", keys[[i]])
    if (!key %in% names(values)) {
      stop("Unknown argument: ", keys[[i]], call. = FALSE)
    }
    values[[key]] <- vals[[i]]
  }

  values$folds <- as.integer(values$folds)
  phenotype_sheet <- trimws(as.character(values$phenotype_sheet))
  if (grepl("^[0-9]+$", phenotype_sheet)) {
    values$phenotype_sheet <- as.integer(phenotype_sheet)
  }
  values$maf <- as.numeric(values$maf)
  values$max_missing <- as.numeric(values$max_missing)
  values$max_markers <- as.integer(values$max_markers)
  values$min_genotypes <- as.integer(values$min_genotypes)
  values
}

require_slurm_if_hcc <- function() {
  host <- Sys.info()[["nodename"]]
  if (grepl("^swan|^login|^hcc", host, ignore.case = TRUE) &&
      identical(Sys.getenv("SLURM_JOB_ID"), "")) {
    stop(
      "This appears to be an HCC login/head node and SLURM_JOB_ID is not set. ",
      "Submit with sbatch instead of running genotype compute directly.",
      call. = FALSE
    )
  }
}

normalize_name <- function(x) {
  gsub("[^a-z0-9]+", "", tolower(x))
}

pick_column <- function(dt, candidates, required = TRUE) {
  lookup <- setNames(names(dt), normalize_name(names(dt)))
  normalized_candidates <- normalize_name(candidates)
  hit <- lookup[normalized_candidates[normalized_candidates %in% names(lookup)]]
  if (length(hit) > 0) {
    return(unname(hit[[1]]))
  }
  if (required) {
    stop(
      "Could not find any of these columns: ",
      paste(candidates, collapse = ", "),
      call. = FALSE
    )
  }
  NA_character_
}

as_numeric_quiet <- function(x) {
  suppressWarnings(as.numeric(x))
}

mask_outer_fence <- function(x) {
  finite_x <- x[is.finite(x)]
  if (length(finite_x) < 5) {
    return(x)
  }
  q1 <- unname(quantile(finite_x, 0.25, na.rm = TRUE, type = 7))
  q3 <- unname(quantile(finite_x, 0.75, na.rm = TRUE, type = 7))
  iqr <- q3 - q1
  lower <- q1 - 3 * iqr
  upper <- q3 + 3 * iqr
  x[x < lower | x > upper] <- NA_real_
  x
}

load_phenotype_means <- function(path, sheet, traits, nitrogen_levels) {
  raw <- as.data.table(readxl::read_excel(path, sheet = sheet))
  genotype_col <- pick_column(raw, c("Genotype", "gneo", "Geno", "Line", "Entry", "Sample", "Taxa", "ID"))
  block_col <- pick_column(raw, c("Block", "BK", "block"), required = FALSE)
  experiment_col <- pick_column(raw, c("experiment", "Nitrogen", "N", "Treatment"), required = FALSE)

  message("Using phenotype genotype column: ", genotype_col)

  pheno <- data.table(
    Genotype = trimws(as.character(raw[[genotype_col]]))
  )

  if (!is.na(block_col)) {
    pheno[, Block := trimws(as.character(raw[[block_col]]))]
  } else {
    pheno[, Block := NA_character_]
  }

  if (!is.na(experiment_col)) {
    treatment_raw <- trimws(as.character(raw[[experiment_col]]))
    pheno[, Nitrogen := fifelse(
      treatment_raw %chin% c("HN", "High N", "HighN", "high N", "high n"),
      "High N",
      fifelse(
        treatment_raw %chin% c("LN", "Low N", "LowN", "low N", "low n"),
        "Low N",
        treatment_raw
      )
    )]
  } else {
    pheno[, Nitrogen := NA_character_]
  }

  pheno[is.na(Nitrogen) | Nitrogen == "", Nitrogen := fifelse(
    Block %chin% c("BK1", "BK3", "B1", "B3"),
    "High N",
    fifelse(Block %chin% c("BK2", "BK4", "B2", "B4"), "Low N", NA_character_)
  )]

  trait_columns <- list(
    ear_weight = c("Ear Weight (g)", "Ear Weight", "whole_weight", "Whole Weight", "ear_weight"),
    TKW = c("Total Kernel Weight (g)", "Total Kernel Weight", "TKW"),
    `20KW` = c("20 KERNELS WEIGHT (g)", "20-kernel weight", "20 Kernel Weight", "20KW", "20 kernel weight"),
    cob_len_cm = c("Cob length (cm)", "Cob Length (cm)", "cob_len_cm"),
    cob_dia_mm = c("Cob diameter (mm)", "Cob Diameter (mm)", "cob_dia_mm")
  )

  for (trait in names(trait_columns)) {
    col <- pick_column(raw, trait_columns[[trait]], required = FALSE)
    pheno[, (trait) := if (is.na(col)) NA_real_ else as_numeric_quiet(raw[[col]])]
  }

  pheno[, CW := ear_weight - TKW]
  pheno[is.finite(CW) & CW < 0, CW := NA_real_]

  for (trait in intersect(traits, names(pheno))) {
    pheno[, (trait) := mask_outer_fence(get(trait))]
  }

  long <- melt(
    pheno,
    id.vars = c("Genotype", "Nitrogen", "Block"),
    measure.vars = intersect(traits, names(pheno)),
    variable.name = "Trait",
    value.name = "Value"
  )
  long <- long[
    !is.na(Genotype) & Genotype != "" &
      Nitrogen %chin% nitrogen_levels &
      is.finite(Value)
  ]

  means <- long[, .(
    PlotRecords = .N,
    TraitMean = mean(Value, na.rm = TRUE),
    TraitSD = sd(Value, na.rm = TRUE)
  ), by = .(Genotype, Nitrogen, Trait)]

  list(plot_long = long, genotype_means = means)
}

run_text <- function(command, args) {
  result <- system2(command, args = args, stdout = TRUE, stderr = TRUE)
  status <- attr(result, "status")
  if (!is.null(status) && status != 0) {
    stop(
      "Command failed: ", command, " ", paste(args, collapse = " "), "\n",
      paste(result, collapse = "\n"),
      call. = FALSE
    )
  }
  result
}

get_vcf_samples <- function(vcf_file) {
  trimws(run_text("bcftools", c("query", "-l", vcf_file)))
}

match_samples <- function(phenotype_ids, vcf_samples) {
  phenotype_ids <- unique(trimws(as.character(phenotype_ids)))
  phenotype_ids <- phenotype_ids[!is.na(phenotype_ids) & phenotype_ids != ""]
  vcf_samples <- trimws(as.character(vcf_samples))

  phenotype_vcf_style <- gsub("\\s+[Xx]\\s+", "/", phenotype_ids, perl = TRUE)
  candidates <- rbindlist(list(
    data.table(
      Genotype = phenotype_ids,
      VcfSample = phenotype_ids,
      MatchType = "exact",
      Priority = 1L
    ),
    data.table(
      Genotype = phenotype_ids,
      VcfSample = phenotype_vcf_style,
      MatchType = "cross_slash",
      Priority = 2L
    )
  ))
  candidates <- candidates[VcfSample %chin% vcf_samples]
  setorder(candidates, Priority, Genotype)
  matched <- unique(candidates, by = "Genotype")
  matched <- unique(matched, by = "VcfSample")
  matched[, Priority := NULL]
  matched[]
}

dosage_from_gt <- function(gt) {
  gt <- sub(":.*$", "", gt)
  gt[gt %chin% c(".", "./.", ".|.")] <- NA_character_
  alleles <- tstrsplit(gt, "[/|]", perl = TRUE)
  if (length(alleles) < 2) {
    return(rep(NA_real_, length(gt)))
  }
  a1 <- suppressWarnings(as.numeric(alleles[[1]]))
  a2 <- suppressWarnings(as.numeric(alleles[[2]]))
  dosage <- a1 + a2
  dosage[is.na(a1) | is.na(a2)] <- NA_real_
  dosage
}

build_grm_from_vcf <- function(vcf_file, matched_samples, outdir, maf, max_missing, max_markers) {
  sample_file <- file.path(outdir, "matched_vcf_samples.txt")
  fwrite(data.table(VcfSample = matched_samples$VcfSample), sample_file, col.names = FALSE)

  query_format <- "%CHROM\\t%POS[\\t%GT]\\n"
  command <- paste(
    "bcftools view",
    "-S", shQuote(sample_file),
    "-m2 -M2 -v snps",
    "-i", shQuote(sprintf("MAF>=%s && F_MISSING<=%s", maf, max_missing)),
    "-Ou", shQuote(vcf_file),
    "| bcftools query -f", shQuote(query_format)
  )

  message("Building GRM from VCF stream.")
  message("Command: ", command)

  con <- pipe(command, open = "r")
  on.exit(close(con), add = TRUE)

  n <- nrow(matched_samples)
  grm_sum <- matrix(0, nrow = n, ncol = n)
  denom <- 0
  markers_seen <- 0L
  markers_used <- 0L
  markers_missing_filtered <- 0L
  markers_maf_filtered <- 0L

  repeat {
    line <- readLines(con, n = 1L)
    if (length(line) == 0L) {
      break
    }
    markers_seen <- markers_seen + 1L
    fields <- strsplit(line, "\t", fixed = TRUE)[[1]]
    gt <- fields[-c(1, 2)]
    if (length(gt) != n) {
      stop("VCF query sample count changed while streaming markers.", call. = FALSE)
    }
    dosage <- dosage_from_gt(gt)
    missing_rate <- mean(!is.finite(dosage))
    if (missing_rate > max_missing) {
      markers_missing_filtered <- markers_missing_filtered + 1L
      next
    }
    p <- mean(dosage, na.rm = TRUE) / 2
    if (!is.finite(p)) {
      markers_missing_filtered <- markers_missing_filtered + 1L
      next
    }
    marker_maf <- min(p, 1 - p)
    if (marker_maf < maf || marker_maf <= 0) {
      markers_maf_filtered <- markers_maf_filtered + 1L
      next
    }

    centered <- dosage - 2 * p
    centered[!is.finite(centered)] <- 0
    grm_sum <- grm_sum + tcrossprod(centered)
    denom <- denom + 2 * p * (1 - p)
    markers_used <- markers_used + 1L

    if (markers_used %% 10000L == 0L) {
      message("Markers used: ", markers_used, " | markers seen: ", markers_seen)
    }
    if (max_markers > 0L && markers_used >= max_markers) {
      message("Stopping at --max-markers=", max_markers)
      break
    }
  }

  if (markers_used < 100L || denom <= 0) {
    stop("Too few usable markers to build a GRM.", call. = FALSE)
  }

  grm <- grm_sum / denom
  rownames(grm) <- matched_samples$Genotype
  colnames(grm) <- matched_samples$Genotype

  summary <- data.table(
    VcfFile = vcf_file,
    Samples = n,
    MarkersSeen = markers_seen,
    MarkersUsed = markers_used,
    MarkersMissingFiltered = markers_missing_filtered,
    MarkersMafFiltered = markers_maf_filtered,
    MAF = maf,
    MaxMissing = max_missing,
    MaxMarkers = max_markers,
    Denominator = denom
  )

  list(K = grm, summary = summary)
}

make_folds <- function(ids, k, seed) {
  set.seed(seed)
  ids <- sample(ids)
  fold_id <- rep(seq_len(k), length.out = length(ids))
  data.table(Genotype = ids, Fold = fold_id)
}

predict_gblup_fold <- function(K, y, test_ids) {
  train_ids <- setdiff(names(y), test_ids)
  y_train <- y[train_ids]
  K_train <- K[train_ids, train_ids, drop = FALSE]
  K_test_train <- K[test_ids, train_ids, drop = FALSE]

  fit <- rrBLUP::mixed.solve(y = y_train, K = K_train)
  lambda <- as.numeric(fit$Ve / fit$Vu)
  beta <- as.numeric(fit$beta)
  lhs <- K_train + diag(lambda + 1e-8, nrow(K_train))
  alpha <- solve(lhs, y_train - beta)
  pred <- beta + as.numeric(K_test_train %*% alpha)

  data.table(
    Genotype = test_ids,
    Observed = as.numeric(y[test_ids]),
    Predicted = pred
  )
}

safe_cor <- function(x, y) {
  ok <- is.finite(x) & is.finite(y)
  if (sum(ok) < 3) {
    return(NA_real_)
  }
  suppressWarnings(cor(x[ok], y[ok]))
}

run_cv <- function(K, phenotype_means, traits, nitrogen_levels, folds, seeds, min_genotypes) {
  predictions <- list()
  accuracy <- list()
  row_id <- 0L
  acc_id <- 0L

  for (trait in traits) {
    for (nitrogen in nitrogen_levels) {
      target <- phenotype_means[Trait == trait & Nitrogen == nitrogen]
      target <- target[Genotype %in% rownames(K)]
      target <- target[!duplicated(Genotype)]
      if (nrow(target) < min_genotypes) {
        warning("Skipping ", trait, " / ", nitrogen, ": only ", nrow(target), " matched genotypes.")
        next
      }

      ids <- target$Genotype
      y <- target$TraitMean
      names(y) <- ids
      K_sub <- K[ids, ids, drop = FALSE]

      for (seed in seeds) {
        fold_table <- make_folds(ids, folds, seed)
        for (fold in seq_len(folds)) {
          test_ids <- fold_table[Fold == fold, Genotype]
          fold_pred <- predict_gblup_fold(K_sub, y, test_ids)
          fold_pred[, `:=`(
            Trait = trait,
            Nitrogen = nitrogen,
            Seed = seed,
            Fold = fold
          )]
          row_id <- row_id + 1L
          predictions[[row_id]] <- fold_pred
        }
      }

      pred_dt <- rbindlist(predictions, fill = TRUE)
      current <- pred_dt[Trait == trait & Nitrogen == nitrogen]
      for (seed in seeds) {
        seed_dt <- current[Seed == seed]
        acc_id <- acc_id + 1L
        accuracy[[acc_id]] <- data.table(
          Trait = trait,
          Nitrogen = nitrogen,
          Seed = seed,
          Folds = folds,
          NGenotypes = uniqueN(seed_dt$Genotype),
          Accuracy = safe_cor(seed_dt$Observed, seed_dt$Predicted),
          BiasSlope = if (nrow(seed_dt) >= 3) {
            coef(lm(Observed ~ Predicted, data = seed_dt))[["Predicted"]]
          } else {
            NA_real_
          },
          RMSE = sqrt(mean((seed_dt$Observed - seed_dt$Predicted)^2, na.rm = TRUE))
        )
      }
    }
  }

  list(
    predictions = rbindlist(predictions, fill = TRUE),
    accuracy = rbindlist(accuracy, fill = TRUE)
  )
}

main <- function() {
  args <- parse_args()
  require_slurm_if_hcc()

  dir.create(args$outdir, recursive = TRUE, showWarnings = FALSE)
  traits <- trimws(strsplit(args$traits, ",", fixed = TRUE)[[1]])
  nitrogen_levels <- trimws(strsplit(args$nitrogen_levels, ",", fixed = TRUE)[[1]])
  seeds <- as.integer(trimws(strsplit(args$seeds, ",", fixed = TRUE)[[1]]))

  fwrite(as.data.table(args), file.path(args$outdir, "baseline_gblup_parameters.csv"))

  phenotype <- load_phenotype_means(
    path = args$phenotype_file,
    sheet = args$phenotype_sheet,
    traits = traits,
    nitrogen_levels = nitrogen_levels
  )
  fwrite(phenotype$genotype_means, file.path(args$outdir, "baseline_phenotype_genotype_means.csv"))

  vcf_samples <- get_vcf_samples(args$vcf_file)
  matched <- match_samples(phenotype$genotype_means$Genotype, vcf_samples)
  if (nrow(matched) < args$min_genotypes) {
    stop("Too few phenotype/genotype sample matches: ", nrow(matched), call. = FALSE)
  }
  message(
    "Matched phenotype/genotype samples: ", nrow(matched), " (",
    paste(names(table(matched$MatchType)), as.integer(table(matched$MatchType)), sep = "=", collapse = ", "),
    ")"
  )
  fwrite(matched, file.path(args$outdir, "baseline_matched_samples.csv"))

  grm <- build_grm_from_vcf(
    vcf_file = args$vcf_file,
    matched_samples = matched,
    outdir = args$outdir,
    maf = args$maf,
    max_missing = args$max_missing,
    max_markers = args$max_markers
  )
  saveRDS(grm$K, file.path(args$outdir, "baseline_genomic_relationship_matrix.rds"))
  fwrite(grm$summary, file.path(args$outdir, "baseline_marker_grm_summary.csv"))

  cv <- run_cv(
    K = grm$K,
    phenotype_means = phenotype$genotype_means,
    traits = traits,
    nitrogen_levels = nitrogen_levels,
    folds = args$folds,
    seeds = seeds,
    min_genotypes = args$min_genotypes
  )
  fwrite(cv$predictions, file.path(args$outdir, "baseline_gblup_predictions.csv"))
  fwrite(cv$accuracy, file.path(args$outdir, "baseline_gblup_accuracy.csv"))

  writeLines(capture.output(sessionInfo()), file.path(args$outdir, "baseline_gblup_session_info.txt"))
  message("Done. Baseline outputs written to: ", args$outdir)
}

main()
