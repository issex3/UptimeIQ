# Thin wrapper — prefer docs/verify.py
param([string]$BaseUrl = "http://localhost:8002")
python "$PSScriptRoot\verify.py" $BaseUrl
exit $LASTEXITCODE
