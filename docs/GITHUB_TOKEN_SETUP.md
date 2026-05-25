# GitHub Token Access

## Token Location
The GitHub Personal Access Token (classic) is stored at:
```
~/.config/gh/hosts.yml
```

## How to Use

### Via gh CLI
```bash
gh auth status          # Verify authentication
gh repo view NaustudentX18/MotionAI --json name  # Test access
```

### Via Environment Variable
```bash
export GITHUB_TOKEN=REDACTED_DO_NOT_COMMIT_REAL_TOKEN
```

### Creating Phase 0 Issues
When network is available, run:
```bash
cd /home/pi/OpenNotion
./scripts/create-github-issues.sh
```

## Account
- GitHub username: NaustudentX18
- Repository: NaustudentX18/MotionAI

## Network Note
This Pi uses Tailscale DNS (100.100.100.100). GitHub requires Tailscale to be running or alternative DNS for external name resolution.
