# Slurm Script Notes

Store HCC batch scripts here.

Recommended conventions:

- one job script per main task
- descriptive names such as `fit_rrblup.sh` or `render_report.sh`
- write stdout and stderr to `slurm-log/`
- keep the Slurm wrapper simple; ideally the execution step is one command line
- put scientific logic, parameters, and command-line options in the actual Bash, Python, R, or other script that the job launches
- check whether the script is running locally or inside a Slurm allocation before doing compute work
- refuse to run compute steps on a head or login node; use `srun --pty bash` for interactive work or submit with `sbatch` so the work lands on a compute node
- document required modules, environments, expected inputs, and resource requests in each script
- inspect system-wide software with `module avail`, record exact loaded module versions, then check `$HOME/bin` only if the module stack does not provide the needed tool
- verify the module system is available, then load and list the modules needed by the job

Keep scientific logic in R or Python code and keep Slurm scripts focused on execution.

Use `hcc_job_template.sh` as the starter template. It includes:

- runtime detection for local versus remote Slurm execution
- a guard that stops the script if it is launched outside a Slurm job
- module discovery, setup, and reporting
- a one-line handoff to the real compute script
- a link back to the HCC docs for GPU, array, and other submission patterns
