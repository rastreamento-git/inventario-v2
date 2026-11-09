import { appearanceUrl } from "../lib/appearance";
import { LayoutGrid, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
export default function ZenCentralLink() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    api
      .get("/auth/config")
      .then(({ data }) => {
        if (data.unified_login) setUrl(data.login_url);
      })
      .catch(() => {});
  }, []);
  if (!url) return null;
  const profile = new URL(url);
  profile.searchParams.set("perfil", "1");
  return [
    [url, "ZenTracking · Aplicativos", LayoutGrid],
    [profile.href, "Meu perfil ZenTracking", UserRound],
  ].map(([href, label, Icon]) => (
    <a
      key={label}
      className="nav-item"
      href={href}
      onClick={(e) => {
        e.preventDefault();
        window.location.assign(appearanceUrl(href));
      }}
    >
      <Icon size={18} />
      <span>{label}</span>
    </a>
  ));
}
