export default function ErrorMessage({ message }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-red-300 text-sm">
      {message || "Something went wrong. Is the API server running on port 8000?"}
    </div>
  );
}
