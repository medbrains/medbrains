import { Skeleton } from "@mantine/core";
import { lazy, Suspense } from "react";
import { useAddProductStore } from "@/components/Materials/add-product-store";
import { useCollect } from "@/components/payments/collect/collect-store";
import { Modal } from "@/components/ui";

// Both modals are mounted once in the shell but used by few roles and rarely.
// A static import put their forms (react-hook-form, zod, the payment tenders,
// the bill print path) on every signed-in user's first screen; now each is
// downloaded the first time its store says it is open.
const AddProductModal = lazy(() =>
  import("@/components/Materials/AddProductModal").then((m) => ({ default: m.AddProductModal })),
);
const CollectDrawer = lazy(() =>
  import("@/components/payments/collect/CollectDrawer").then((m) => ({
    default: m.CollectDrawer,
  })),
);

const LOADING_HEIGHT = 240;

interface LoadingModalProps {
  title: string;
  size: string | number;
  onClose: () => void;
}

/** The same modal frame, open with a skeleton, while the real one downloads. */
function LoadingModal({ title, size, onClose }: LoadingModalProps) {
  return (
    <Modal opened onClose={onClose} title={title} size={size}>
      <Skeleton height={LOADING_HEIGHT} aria-label={`Loading ${title.toLowerCase()}`} />
    </Modal>
  );
}

/**
 * The shell's open-from-anywhere modals, each fetched only once it is opened.
 * A chunk that fails to load is caught by the shell's route error boundary.
 */
export function OnDemandOverlays() {
  const isAddProductOpen = useAddProductStore((s) => s.opened);
  const closeAddProduct = useAddProductStore((s) => s.close);
  const isCollectOpen = useCollect((s) => s.target !== null);
  const closeCollect = useCollect((s) => s.close);
  return (
    <>
      {isAddProductOpen && (
        <Suspense
          fallback={<LoadingModal title="Add product" size="lg" onClose={closeAddProduct} />}
        >
          <AddProductModal />
        </Suspense>
      )}
      {isCollectOpen && (
        <Suspense
          fallback={<LoadingModal title="Collect payment" size={480} onClose={closeCollect} />}
        >
          <CollectDrawer />
        </Suspense>
      )}
    </>
  );
}
