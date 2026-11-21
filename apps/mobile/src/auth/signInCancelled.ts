/** Someone closed Google's or Apple's sign-in sheet. Not an error worth a message. */
export class SignInCancelled extends Error {
  constructor() {
    super("Sign-in was cancelled.");
    this.name = "SignInCancelled";
  }
}
