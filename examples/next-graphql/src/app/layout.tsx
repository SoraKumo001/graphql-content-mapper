import "@/global.css";
import { UrqlProvider } from "@/components/Provider/UrqlProvider";

export const metadata = {
  title: "Next.js GraphQL",
  description: "Next.js GraphQL with Prisma and Pothos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <UrqlProvider endpoint="/graphql">{children}</UrqlProvider>
      </body>
    </html>
  );
}
