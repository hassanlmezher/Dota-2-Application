export default function Loader({ label = "Loading..." }) {
  return (
    <div className="loader">
      <span className="loader__spinner" />
      <p>{label}</p>
    </div>
  );
}
