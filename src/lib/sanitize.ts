export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // remove angle brackets
    .replace(/javascript:/gi, "") // remove javascript: protocol
    .replace(/on\w+=/gi, "") // remove event handlers
    .trim()
    .slice(0, 10000); // enforce max length
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 254);
}

export function isValidEmail(email: string): boolean {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}
