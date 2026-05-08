import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

const DEFAULT_APK_URL = "https://typing-dash-race.lovable.app/app-admin.apk";
const DEFAULT_CHECKSUM_HEX =
  "ebe9f1d0b6e3238af63c768c1d8c8e708ab911502434454cd47e0766836c5b28";

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

// Validation helpers
const isValidHex = (hex: string): boolean => /^[0-9a-fA-F]+$/.test(hex) && hex.length === 64;
const isValidSsid = (ssid: string): boolean => ssid.length >= 1 && ssid.length <= 32;
const isValidWifiPassword = (pw: string): boolean => pw.length >= 8 && pw.length <= 63;

export default function Provisionamento() {
  const [component, setComponent] = useState(
    "deltazero.amarok.foss/.receivers.AdminReceiver"
  );
  const [checksumHex, setChecksumHex] = useState(
    "32aaf66465c5e7d093db2f12647528a1aaedcc8872d18a7393a8542761993486"
  );
  const [ssid, setSsid] = useState("Rangel");
  const [password, setPassword] = useState("211292abc");
  const [touched, setTouched] = useState({
    checksum: false,
    ssid: false,
    password: false,
  });

  const checksumBase64Url = useMemo(
    () => hexToBase64UrlSafe(checksumHex),
    [checksumHex]
  );

  // Validate fields
  const errors = useMemo(() => {
    return {
      checksum: !isValidHex(checksumHex),
      ssid: !isValidSsid(ssid),
      password: !isValidWifiPassword(password),
    };
  }, [checksumHex, ssid, password]);

  const allValid = !errors.checksum && !errors.ssid && !errors.password;

  const json = useMemo(() => {
    if (!allValid) return "";
    const obj: Record<string, string> = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": component,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
        APK_URL,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM":
        checksumBase64Url,
      "android.app.extra.PROVISIONING_WIFI_SSID": ssid,
      "android.app.extra.PROVISIONING_WIFI_PASSWORD": password,
      "android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE": "WPA",
    };
    return JSON.stringify(obj);
  }, [component, checksumBase64Url, ssid, password, allValid]);

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
              <Label htmlFor="checksum">
                Checksum (Hexadecimal)
              </Label>
              <Input
                id="checksum"
                value={checksumHex}
                onChange={(e) => {
                  setChecksumHex(e.target.value);
                  setTouched((prev) => ({ ...prev, checksum: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, checksum: true }))}
                placeholder="SHA-256 do APK em hexadecimal"
                className={touched.checksum && errors.checksum ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {touched.checksum && errors.checksum && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  O checksum deve ser uma string hexadecimal de exatamente 64 caracteres.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ssid">SSID do Wi-Fi</Label>
              <Input
                id="ssid"
                value={ssid}
                onChange={(e) => {
                  setSsid(e.target.value);
                  setTouched((prev) => ({ ...prev, ssid: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, ssid: true }))}
                className={touched.ssid && errors.ssid ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {touched.ssid && errors.ssid && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  O SSID deve ter entre 1 e 32 caracteres.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha do Wi-Fi</Label>
              <Input
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setTouched((prev) => ({ ...prev, password: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                className={touched.password && errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {touched.password && errors.password && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  A senha deve ter entre 8 e 63 caracteres.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-4 flex flex-col items-center">
            <h2 className="font-semibold self-start">QR Code</h2>
            {allValid && json ? (
              <>
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeCanvas value={json} size={280} level="M" />
                </div>
                <pre className="w-full text-xs bg-muted rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                  {JSON.stringify(JSON.parse(json), null, 2)}
                </pre>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 min-h-[280px] text-muted-foreground">
                <AlertCircle className="w-8 h-8" />
                <p className="text-sm text-center">
                  Preencha todos os campos corretamente para gerar o QR Code.
                </p>
                <div className="space-y-1 text-xs text-center">
                  {errors.checksum && (
                    <p className="text-destructive">Checksum inválido (64 hex chars)</p>
                  )}
                  {errors.ssid && (
                    <p className="text-destructive">SSID inválido (1-32 chars)</p>
                  )}
                  {errors.password && (
                    <p className="text-destructive">Senha inválida (8-63 chars)</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
