# YNAB CLI

[![npm version](https://img.shields.io/npm/v/@stephendolan/ynab-cli.svg)](https://www.npmjs.com/package/@stephendolan/ynab-cli)
[![npm downloads](https://img.shields.io/npm/dm/@stephendolan/ynab-cli.svg)](https://www.npmjs.com/package/@stephendolan/ynab-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.0-black)](https://bun.sh)

A command-line interface for You Need a Budget (YNAB) designed to enable LLMs (Claude, ChatGPT, etc.) and developers to quickly interface with YNAB budgets, make changes, and audit financial data.

## Features

- **LLM-First Design**: JSON output by default for easy parsing and integration with AI assistants
- **Advanced Filtering**: Built-in filters reduce need for external tools like `jq` - filter by approval status, amount ranges, field selection, and search capabilities
- **Comprehensive Coverage**: Support for all major YNAB API endpoints
- **Type Safety**: Built with TypeScript for robust error handling
- **Raw API Access**: Fallback command for any operation not covered by convenience commands
- **Simple Authentication**: Uses personal access tokens stored securely in OS keychain

## Installation

Requires [Bun](https://bun.sh) runtime.

```bash
# Install globally with bun (recommended)
bun install -g @stephendolan/ynab-cli

# Or run directly without installing
bunx @stephendolan/ynab-cli budgets list
npx @stephendolan/ynab-cli budgets list  # also works
```

### Linux Prerequisites

Requires `libsecret` for keychain storage:

```bash
# Ubuntu/Debian
sudo apt-get install libsecret-1-dev

# Fedora/RHEL
sudo dnf install libsecret-devel

# Arch Linux
sudo pacman -S libsecret
```

Without `libsecret`, use the `YNAB_API_KEY` environment variable instead.

### From Source

```bash
git clone https://github.com/stephendolan/ynab-cli.git
cd ynab-cli
bun install
bun run link  # Build and link globally
```

## Authentication

Set your YNAB personal access token using the CLI or environment variables:

```bash
ynab auth login    # Interactive token entry, stored in OS keychain
ynab auth status   # Check authentication status
ynab auth logout   # Remove stored credentials
```

Or use environment variables (recommended for development):

```env
YNAB_API_KEY=your_personal_access_token
YNAB_BUDGET_ID=your_default_budget_id  # Optional
```

## Usage

### Global Flags

```bash
--compact, -c          # Minified JSON output (single line)
```

### Commands

#### User

```bash
ynab user info    # Get authenticated user information
```

#### Budgets

```bash
ynab budgets list                 # List all budgets
ynab budgets view [id]            # View budget details
ynab budgets settings [id]        # View budget settings
ynab budgets set-default <id>     # Set default budget
```

#### Accounts

```bash
ynab accounts list                # List all accounts
ynab accounts view <id>           # View account details
ynab accounts transactions <id>   # List transactions for account
```

#### Categories

```bash
ynab categories list                            # List all categories
ynab categories view <id>                       # View category details
ynab categories budget <id> --month <YYYY-MM> --amount <amount>
ynab categories transactions <id>               # List transactions for category
```

#### Transactions

```bash
# List and filter
ynab transactions list
ynab transactions list --account <id>
ynab transactions list --category <id>
ynab transactions list --payee <id>
ynab transactions list --since <YYYY-MM-DD> --until <YYYY-MM-DD>
ynab transactions list --approved=false
ynab transactions list --min-amount 100 --max-amount 500
ynab transactions list --status=cleared,reconciled
ynab transactions list --fields id,date,amount,memo

# Search
ynab transactions search --memo "coffee"
ynab transactions search --payee-name "Amazon"
ynab transactions search --amount 42.50

# CRUD operations
ynab transactions view <id>
ynab transactions create
ynab transactions create --account <id> --amount <amount> --date <YYYY-MM-DD>
ynab transactions update <id> --amount <amount>
ynab transactions delete <id>
ynab transactions import
ynab transactions split <id> --splits '[{"amount": -50.00, "category_id": "xxx", "memo": "..."}]'
```

#### Scheduled Transactions

```bash
ynab scheduled list        # List all scheduled transactions
ynab scheduled view <id>   # View scheduled transaction
ynab scheduled delete <id> # Delete scheduled transaction
```

#### Payees

```bash
ynab payees list                        # List all payees
ynab payees view <id>                   # View payee details
ynab payees update <id> --name <name>   # Rename payee
ynab payees locations <id>              # List locations for payee
ynab payees transactions <id>           # List transactions for payee
```

#### Months

```bash
ynab months list            # List all budget months
ynab months view <YYYY-MM>  # View specific month details
```

#### Raw API Access

```bash
ynab api <method> <path> [--data <json>]

# Examples:
ynab api GET /budgets
ynab api GET /budgets/{budget_id}/transactions
ynab api POST /budgets/{budget_id}/transactions --data '{"transaction": {...}}'
```

## Output Format

All commands return JSON by default:

- **Lists**: Arrays of objects (not wrapped)
- **Single items**: Objects directly
- **Errors**: `{"error": {"name": "...", "detail": "...", "statusCode": 400}}`

## Currency Format

**All amounts are in dollars.** The CLI automatically converts YNAB's internal milliunit format (1000 = $1.00) in both input and output.

- Input: `--min-amount 100` means $100
- Output: `"amount": -555.28` means -$555.28

## API Limitations

The YNAB API does not support:

- Creating categories, category groups, or payees
- Updating accounts (beyond initial creation)

Use the YNAB web or mobile app for these operations.

## API Rate Limits

The YNAB API enforces a rate limit of **200 requests per hour** per access token. When exceeded, the API returns HTTP 429 errors.

**If you hit the rate limit:**
- Wait 5-10 minutes before retrying (the limit uses a rolling 60-minute window)
- For batch operations, add delays between requests: `sleep 20` in shell loops ensures ~180 requests/hour

## References

- [YNAB API Documentation](https://api.ynab.com/)
- [YNAB JavaScript SDK](https://github.com/ynab/ynab-sdk-js)
- [Specification](./SPEC.md)

## License

MIT
