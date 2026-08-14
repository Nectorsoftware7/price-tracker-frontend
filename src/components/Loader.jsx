// A branded loading spinner (a spinning gradient ring with a subtle drop shadow for
// depth) used anywhere the app previously showed a plain "Loading..." string. Pure CSS
// animation — no extra dependency — see the .loader-* rules in index.css.
export default function Loader({ label = "Loading..." }) {
  return (
    <div className="loader">
      <div className="loader-ring" />
      <p className="loader-label">{label}</p>
    </div>
  );
}
