# YNAB CLI

[![npm version](https://img.shields.io/npm/v/@stephendolan/ynab-cli.svg)](https://www.npmjs.com/package/@stephendolan/ynab-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A command-line interface for YNAB designed for LLMs and developers. JSON output by default with built-in filtering.

## Installation

Requires [Bun](https://bun.sh).

```bash
bun install -g @stephendolan/ynab-cli

# Or run without installing
bunx @stephendolan/ynab-cli budgets list
```

<details>
<summary>Linux: requires libsecret for keychain storage</summary>

```bash
sudo apt-get install libsecret-1-dev  # Ubuntu/Debian
sudo dnf install libsecret-devel      # Fedora/RHEL
sudo pacman -S libsecret              # Arch
```

Without libsecret, use `YNAB_API_KEY` environment variable instead.
</details>

## Authentication

```bash
ynab auth login    # Store token in OS keychain
ynab auth status   # Check authentication
ynab auth logout   # Remove credentials
```

Or set `YNAB_API_KEY` environment variable.

## Commands

### Budgets

```bash
ynab budgets list
ynab budgets view [id]
ynab budgets settings [id]
ynab budgets set-default <id>
```

### Accounts

```bash
ynab accounts list
ynab accounts view <id>
ynab accounts transactions <id>
```

### Categories

```bash
ynab categories list
ynab categories view <id>
ynab categories update <id> [--name <name>] [--note <note>] [--category-group-id <id>] [--goal-target <amount>]
ynab categories budget <id> --month <YYYY-MM> --amount <amount>
ynab categories transactions <id>
```

### Transactions

```bash
# List with filters
ynab transactions list --account <id> --since <YYYY-MM-DD>
ynab transactions list --approved=false --min-amount 100
ynab transactions list --fields id,date,amount,memo

# Search
ynab transactions search --memo "coffee"
ynab transactions search --payee-name "Amazon"

# CRUD
ynab transactions view <id>
ynab transactions create --account <id> --amount <amount> --date <YYYY-MM-DD>
ynab transactions update <id> --amount <amount>
ynab transactions delete <id>
ynab transactions split <id> --splits '[{"amount": -50.00, "category_id": "xxx"}]'
```

### Payees

```bash
ynab payees list
ynab payees view <id>
ynab payees update <id> --name <name>
ynab payees locations <id>
ynab payees transactions <id>
```

### Months

```bash
ynab months list
ynab months view <YYYY-MM>
```

### Scheduled Transactions

```bash
ynab scheduled list
ynab scheduled view <id>
ynab scheduled delete <id>
```

### Raw API Access

```bash
ynab api GET /plans
ynab api POST /plans/{plan_id}/transactions --data '{"transaction": {...}}'
```

### MCP Server

Run as an MCP server for AI agent integration:

```bash
ynab mcp
```

## Output

All commands return JSON. Use `--compact` for minified output.

**Amounts are in dollars** (not YNAB's internal milliunits). `--min-amount 100` means $100.

## API Limitations

The YNAB API does not support creating categories, category groups, or payees. Use the web or mobile app for these.

Rate limit: 200 requests/hour per token. If exceeded, wait 5-10 minutes.

## References

- [YNAB API Documentation](https://api.ynab.com/)
- [Specification](./SPEC.md)

## License

MIT
