export default function WorkspaceLoading() {
  return (
    <div className="grid h-full min-h-0 place-items-center" role="status" aria-label="Loading">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#e6e8ec] border-t-[#111827]" />
    </div>
  );
}
