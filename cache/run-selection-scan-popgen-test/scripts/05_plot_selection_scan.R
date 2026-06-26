args <- commandArgs(trailingOnly = TRUE)
prefix <- ifelse(length(args) >= 1, args[[1]], "popgen_chr10_skill_test")
fst_prefix <- ifelse(length(args) >= 2, args[[2]], "popgen_chr10_skill_test_filtered_temporal_vs_filtered_tropical")

theta_file <- paste0(prefix, ".thetasWindow25000.pestPG")
if (file.exists(theta_file)) {
  d <- read.table(theta_file, header = TRUE)
  if ("tP" %in% names(d) && "nSites" %in% names(d)) {
    png(paste0(prefix, "_pairwise_theta.png"), width = 1400, height = 700)
    plot(d$WinCenter / 1e6, d$tP / d$nSites,
         xlab = "Window center (Mb)", ylab = "Pairwise theta per site",
         pch = 16, col = rgb(0.1, 0.35, 0.8, 0.55))
    dev.off()
  }
}

fst_file <- paste0(fst_prefix, ".windowed_fixed.fst")
if (file.exists(fst_file)) {
  fst <- read.table(fst_file, header = TRUE)
  value_col <- grep("WEIGHTED_FST|MEAN_FST", names(fst), value = TRUE)[1]
  pos_col <- grep("BIN_START|BIN_END", names(fst), value = TRUE)[1]
  if (!is.na(value_col) && !is.na(pos_col)) {
    png(paste0(fst_prefix, "_fst.png"), width = 1400, height = 700)
    plot(fst[[pos_col]] / 1e6, fst[[value_col]],
         xlab = "Position (Mb)", ylab = value_col,
         pch = 16, col = rgb(0.75, 0.15, 0.1, 0.55))
    dev.off()
  }
}
