/**
 * Converts raw onchain/wallet errors into short, user-friendly messages.
 */
export function parseOnchainError(error: unknown): string {
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase()

  if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('4001')) {
    return 'Transaction cancelled.'
  }
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
    return 'Insufficient balance. Please add funds and try again.'
  }
  if (msg.includes('insufficient allowance') || msg.includes('erc20insufficientallowance')) {
    return 'Allowance too low. Please approve USDC first.'
  }
  if (msg.includes('zeroaddress')) {
    return 'Invalid address — please enter a valid recipient.'
  }
  if (msg.includes('zeroamount')) {
    return 'Amount must be greater than zero.'
  }
  if (msg.includes('reverted')) {
    const match = msg.match(/reason[:\s]+"?([^"]+)"?/)
    return match ? `Transaction failed: ${match[1]}` : 'Transaction failed. Please try again.'
  }
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')) {
    return 'Network error. Check your connection and retry.'
  }
  return 'Something went wrong. Please try again.'
}
