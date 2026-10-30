export function passwordError(password: string): string | null {
  if (password.length < 8 || password.length > 128) {
    return "Password must be 8 to 128 characters.";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include a letter and a number.";
  }
  return null;
}
