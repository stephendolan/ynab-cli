# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YNAB CLI is a command-line interface for You Need a Budget (YNAB) designed for LLMs and developers to interface with YNAB budgets. The CLI outputs JSON by default and provides built-in filtering capabilities to reduce dependency on external tools.

## Development Commands

### Running and Building
```bash
npm run dev          # Run CLI in development mode with tsx (no build required)
npm run build        # Build for production using tsup
npm run link         # Build and link globally (makes `ynab` available system-wide)
npm start            # Run built CLI from dist/

# Testing the CLI locally
tsx src/cli.ts <command>     # Run directly without building
node dist/cli.js <command>   # Run after building
```

### Quality Checks
```bash
npm run typecheck    # Type check without emitting files
npm run lint         # Lint TypeScript files in src/
npm test            # Run vitest tests
```

## Architecture

### Core Structure

The CLI follows a command-based architecture built on Commander.js:

- **src/cli.ts**: Entry point that registers all commands and handles global flags (`--compact`, `--output`, `--budget`)
- **src/commands/**: Each file exports a `create*Command()` function that returns a Commander Command
  - Commands: auth, user, budgets, accounts, categories, transactions, scheduled, payees, months, api
- **src/lib/**: Shared utilities and core functionality
  - **api-client.ts**: Main YNAB API wrapper (`YnabClient` class) - single source of truth for API calls
  - **auth.ts**: OS keychain integration via @napi-rs/keyring for secure token storage
  - **config.ts**: Application config management via `conf` package (stores default budget ID)
  - **output.ts**: JSON output formatting with automatic milliunit conversion
  - **utils.ts**: Currency conversion, date formatting, filtering, field selection
  - **errors.ts**: Centralized error handling for YNAB API errors
  - **command-utils.ts**: Shared command helpers
  - **prompts.ts**: Interactive prompts using inquirer
- **src/types/**: TypeScript type definitions

### Authentication Flow

1. Priority order: CLI keychain → `YNAB_API_KEY` env var
2. Default budget: `--budget` flag → config file → `YNAB_BUDGET_ID` env var
3. Tokens stored in OS keychain via @napi-rs/keyring (service: 'ynab-cli', account: 'access-token')

### Currency Handling

**Critical**: All amounts are automatically converted between YNAB's milliunit format (1000 = $1.00) and dollars:

- **Input**: User provides amounts in dollars (e.g., `--min-amount 100`)
- **Internal**: Code uses `amountToMilliunits()` to convert dollars to milliunits for API calls
- **Output**: `convertMilliunitsToAmounts()` recursively converts all amount fields in JSON output to dollars
- Fields converted: `amount`, `balance`, `*_balance`, `budgeted`, `activity`, `available`, `goal_target`, `*_amount`

### Output System

All commands use `outputJson()` from src/lib/output.ts which:
1. Recursively converts milliunits to dollar amounts
2. Formats as JSON (pretty or compact based on `--compact` flag)
3. Writes to file or stdout based on `--output` flag

List commands return arrays directly (not wrapped in objects) for easy piping to other tools.

### Error Handling

All API calls go through `YnabClient.withErrorHandling()` which catches errors and passes them to `handleYnabError()` in src/lib/errors.ts. Errors are output as JSON:
```json
{
  "error": {
    "name": "error_name",
    "detail": "Error detail",
    "statusCode": 400
  }
}
```

## Adding New Commands

1. Create or modify file in src/commands/
2. Export a `create*Command()` function that returns a Commander Command
3. Register in src/cli.ts
4. Use `client` from src/lib/api-client.ts for API calls
5. Use `outputJson()` or `outputSuccess()` for JSON output
6. Handle milliunits conversion:
   - Input: Use `amountToMilliunits()` for user-provided amounts
   - Output: Automatic via `outputJson()` - don't manually convert

## API Limitations

YNAB API does not support:
- Creating categories or category groups
- Creating payees
- Creating or updating accounts (beyond initial creation)

These operations must be done through YNAB's web/mobile apps.

## Testing

Tests use Vitest. Run with `npm test`.

## Build Configuration

- **tsup.config.ts**: Bundles src/cli.ts → dist/cli.js as ESM for Node 18+
- **package.json**: Type is "module" (ESM), main is dist/cli.js, bin is "ynab"
- Shebang in src/cli.ts makes dist/cli.js directly executable
