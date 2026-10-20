import { appearanceUrl } from "../lib/appearance";
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
  return url ? (
    <a
      className="nav-item"
      href={url}
      onClick={(e) => {
        e.preventDefault();
        window.location.assign(appearanceUrl(url));
      }}
    >
      ZenTracking · Aplicativos
    </a>
  ) : null;
}
