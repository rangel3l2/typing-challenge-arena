import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const APK_URL = "https://euvoujogar.com.br/app-admin.apk";

const hexToBase64UrlSafe = (hexString: string): string => {
  try {
    const match = hexString.match(/\w{2}/g);
    if (!match) return "";
    const base64 = btoa(
      match.map((a) => String.fromCharCode(parseInt(a, 16))).join("")
    );
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (e) {
    return "";
  }
};

export default function Provisionamento() {
  const [component, setComponent] = useState(
    "deltazero.amarok.foss/.receivers.AdminReceiver"
  );
  const [checksumHex, setChecksumHex] = useState(
    "32aaf66465c5e7d093db2f12647528a1aaedcc8872d18a7393a8542761993486"
  );
  const [ssid, setSsid] = useState("Rangel");
  const [password, setPassword] = useState("211292abc");

  const checksumBase64Url = useMemo(
    () => hexToBase64UrlSafe(checksumHex),
    [checksumHex]
  );

  const json = useMemo(() => {
    const obj: Record<string, string> = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": component,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
        APK_URL,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM":
        checksumBase64Url || "SEU_CHECKSUM_AQUI",
      "android.app.extra.PROVISIONING_WIFI_SSID": ssid,
      "android.app.extra.PROVISIONING_WIFI_PASSWORD": password,
      "android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE": "WPA",
    };
    return JSON.stringify(obj);
  }, [component, checksumBase64Url, ssid, password]);

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">
            Provisionamento Android Enterprise
          </h1>
          <p className="text-sm text-muted-foreground">
            Device Owner via QR Code
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Download do APK</h2>
          <p className="text-sm text-muted-foreground break-all">{APK_URL}</p>
          <Button asChild>
            <a href="/app-admin.apk" download>
              Baixar app-admin.apk
            </a>
          </Button>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold">Configuração</h2>
            <div className="space-y-2">
              <Label htmlFor="component">Package/Receiver</Label>
              <Input
                id="component"
                value={component}
                onChange={(e) => setComponent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checksum">Checksum (Hexadecimal)</Label>
              <Input
                id="checksum"
                value={checksumHex}
                onChange={(e) => setChecksumHex(e.target.value)}
                placeholder="SHA-256 do APK em hexadecimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssid">SSID do Wi-Fi</Label>
              <Input
                id="ssid"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha do Wi-Fi</Label>
              <Input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-4 flex flex-col items-center">
            <h2 className="font-semibold self-start">QR Code</h2>
            <div className="bg-white p-4 rounded-lg">
              <QRCodeCanvas value={json} size={280} level="M" />
            </div>
            <pre className="w-full text-xs bg-muted rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
              {JSON.stringify(JSON.parse(json), null, 2)}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}

