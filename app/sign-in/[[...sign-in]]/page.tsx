import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <SignIn 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          }
        }}
        fallbackRedirectUrl="/feed"
        signUpUrl="/sign-up"
      />
    </div>
  );
}
