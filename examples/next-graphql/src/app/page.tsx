import { Home } from "./Home";

export default async function Page(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const page = Number(searchParams?.page) || 1;
  return <Home page={page} />;
}
