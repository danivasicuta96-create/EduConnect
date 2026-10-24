// Shared by client forms and server validation.
export const PASSWORD_RULES = "At least 10 characters, including a letter and a number.";

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (password.length > 200) return "Password is too long.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Password must include a letter and a number.";
  return null;
}
