export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        <main className="container mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}
