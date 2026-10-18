import { OwnerFlow } from "../../owner-flow";
export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OwnerFlow mode="customer-profile" customerId={id} />;
}
