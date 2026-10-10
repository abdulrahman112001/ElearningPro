import { BatchDetail } from "@/components/codes/batch-detail"

export default function CodeBatchPage({ params }: { params: { batchId: string } }) {
  return <BatchDetail scope="instructor" batchId={params.batchId} />
}
