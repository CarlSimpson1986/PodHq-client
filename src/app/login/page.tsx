import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ confirmed?: string }> }) {
  // Arriving from the signup email's link (/auth/confirm).
  const { confirmed } = await searchParams;
  return <LoginForm confirmed={confirmed === "1"} />;
}
