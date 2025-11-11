import chalk from 'chalk';

export class Logger {
  static trader(traderName: string, message: string): void {
    console.log(chalk.green(`[${traderName}]`), message);
  }

  static traderAction(
    traderName: string,
    action: string,
    details?: string
  ): void {
    console.log(chalk.green.bold(`[${traderName}] ${action}`), details || '');
  }

  static researcher(message: string): void {
    console.log(chalk.blue('[Researcher]'), message);
  }

  static researcherAction(action: string, details?: string): void {
    console.log(chalk.blue.bold('[Researcher]'), action, details || '');
  }

  static info(message: string): void {
    console.log(chalk.white(message));
  }

  static warn(message: string): void {
    console.log(chalk.yellow('[WARNING]'), message);
  }

  static error(message: string, error?: Error | unknown): void {
    console.log(chalk.red('[ERROR]'), message);
    if (error) {
      if (error instanceof Error) {
        console.log(chalk.red(error.message));
        if (error.stack) {
          console.log(chalk.red(error.stack));
        }
      } else {
        console.log(chalk.red(String(error)));
      }
    }
  }

  static success(message: string): void {
    console.log(chalk.green('[SUCCESS]'), message);
  }

  static section(title: string): void {
    console.log('\n' + chalk.cyan.bold('='.repeat(50)));
    console.log(chalk.cyan.bold(title));
    console.log(chalk.cyan.bold('='.repeat(50)) + '\n');
  }

  static tool(toolName: string, description: string): void {
    console.log(chalk.magenta(`[TOOL: ${toolName}]`), description);
  }

  static buyOrder(
    traderName: string,
    quantity: number,
    symbol: string,
    rationale?: string
  ): void {
    console.log(
      chalk.green.bold(`[${traderName}] BUY:`),
      `${quantity} shares of ${symbol}`
    );
    if (rationale) {
      console.log(chalk.green(`  Rationale: ${rationale}`));
    }
  }

  static sellOrder(
    traderName: string,
    quantity: number,
    symbol: string,
    rationale?: string
  ): void {
    console.log(
      chalk.red.bold(`[${traderName}] SELL:`),
      `${quantity} shares of ${symbol}`
    );
    if (rationale) {
      console.log(chalk.red(`  Rationale: ${rationale}`));
    }
  }

  static portfolio(traderName: string, message: string): void {
    console.log(chalk.cyan(`[${traderName}] PORTFOLIO:`), message);
  }

  static search(query: string): void {
    console.log(chalk.blue('[SEARCH]'), `Query: "${query}"`);
  }

  static analysis(subject: string): void {
    console.log(chalk.blue('[ANALYSIS]'), `Analyzing: ${subject}`);
  }
}
