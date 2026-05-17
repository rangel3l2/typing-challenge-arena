import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, RefreshCw, ShieldCheck, ShieldAlert, Download, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

// GitHub repo onde ficam o APK + latest.json + sha256.txt.
// Para publicar uma nova versão: faça commit dos arquivos novos em /releases na branch main.
const GITHUB_OWNER = "rangel3l21";
const GITHUB_REPO = "tablet-EPT-Manager";
const GITHUB_BRANCH = "main";
const GITHUB_RELEASES_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/releases`;
const LATEST_JSON_URL = `${GITHUB_RELEASES_BASE}/latest.json`;
const SHA256_TXT_URL = `${GITHUB_RELEASES_BASE}/sha256.txt`;

// Fallback caso o fetch do GitHub falhe (último APK conhecido).
const FALLBACK_APK_URL = `${GITHUB_RELEASES_BASE}/Amarok-v0.10.1+fd95cb3-foss.apk`;
const DEFAULT_SIGNATURE_CHECKSUM =
  "Mqr2ZGXF59CT2y8SZHUooartzIhy0Ypzk6hUJ2GZNIY";

interface LatestManifest {
  releaseFile?: string;
  downloadUrl?: string;
  signatureChecksum?: string;
  version?: string;
}

// Validation helpers
const isValidChecksum = (checksum: string): boolean =>
  /^[A-Za-z0-9_-]{43}$/.test(checksum);
const isValidSsid = (ssid: string): boolean => ssid.length >= 1 && ssid.length <= 32;
const isValidWifiPassword = (pw: string): boolean => pw.length >= 8 && pw.length <= 63;

export default function Provisionamento() {
  const [component, setComponent] = useState(
    "deltazero.amarok.foss/deltazero.amarok.receivers.AdminReceiver"
  );
  const [apkUrl, setApkUrl] = useState(FALLBACK_APK_URL);
  const [checksum, setChecksum] = useState(DEFAULT_SIGNATURE_CHECKSUM);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);

  // SHA-256 verification state
  type VerifyStatus = "idle" | "downloading" | "verifying" | "ok" | "error";
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyProgress, setVerifyProgress] = useState(0);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [expectedSha, setExpectedSha] = useState<string | null>(null);
  const [actualSha, setActualSha] = useState<string | null>(null);
  const [apkBlobUrl, setApkBlobUrl] = useState<string | null>(null);
  const [apkFileName, setApkFileName] = useState<string>("app-admin.apk");

  const resetVerification = () => {
    setVerifyStatus("idle");
    setVerifyProgress(0);
    setVerifyError(null);
    setExpectedSha(null);
    setActualSha(null);
    if (apkBlobUrl) {
      URL.revokeObjectURL(apkBlobUrl);
      setApkBlobUrl(null);
    }
  };

  const bufferToHex = (buf: ArrayBuffer): string =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const downloadAndVerify = async () => {
    resetVerification();
    setVerifyStatus("downloading");
    try {
      // 1. Buscar SHA-256 esperado
      const fileName = apkUrl.split("/").pop() || "app-admin.apk";
      setApkFileName(fileName);
      const shaRes = await fetch(`${SHA256_TXT_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!shaRes.ok) throw new Error(`Falha ao buscar sha256.txt (HTTP ${shaRes.status})`);
      const shaText = await shaRes.text();
      // formato: "<hash>  <filename>" (uma ou várias linhas)
      const lines = shaText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let expected: string | null = null;
      for (const line of lines) {
        const m = line.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
        if (m) {
          if (m[2] === fileName || lines.length === 1) {
            expected = m[1].toLowerCase();
            if (m[2] === fileName) break;
          }
        }
      }
      if (!expected) throw new Error(`SHA-256 esperado não encontrado para ${fileName} no sha256.txt`);
      setExpectedSha(expected);

      // 2. Baixar APK com progresso
      const apkRes = await fetch(apkUrl, { cache: "no-store" });
      if (!apkRes.ok) throw new Error(`Falha ao baixar APK (HTTP ${apkRes.status})`);
      const total = Number(apkRes.headers.get("content-length")) || 0;
      const reader = apkRes.body?.getReader();
      if (!reader) throw new Error("Stream do APK indisponível");
      const chunks: Uint8Array[] = [];
      let received = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total) setVerifyProgress(Math.round((received / total) * 100));
        }
      }
      const blob = new Blob(chunks as BlobPart[], { type: "application/vnd.android.package-archive" });
      const buf = await blob.arrayBuffer();

      // 3. Computar SHA-256
      setVerifyStatus("verifying");
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const actual = bufferToHex(digest);
      setActualSha(actual);

      if (actual !== expected) {
        setVerifyStatus("error");
        setVerifyError(
          `Soma de verificação SHA-256 não confere. O arquivo baixado pode estar corrompido ou ter sido adulterado. NÃO instale.`
        );
        toast({
          title: "SHA-256 inválido",
          description: "O APK baixado não corresponde ao hash oficial.",
          variant: "destructive",
        });
        return;
      }

      // 4. Sucesso — disponibilizar para instalação
      const url = URL.createObjectURL(blob);
      setApkBlobUrl(url);
      setVerifyStatus("ok");
      toast({
        title: "APK verificado",
        description: "SHA-256 confere. Você já pode instalar com segurança.",
      });
    } catch (err) {
      setVerifyStatus("error");
      setVerifyError(err instanceof Error ? err.message : String(err));
      toast({
        title: "Falha na verificação",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    return () => {
      if (apkBlobUrl) URL.revokeObjectURL(apkBlobUrl);
    };
  }, [apkBlobUrl]);

  // Resetar verificação ao trocar de URL do APK
  useEffect(() => {
    resetVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apkUrl]);

  const fetchLatest = async (silent = false) => {
    setLoadingLatest(true);
    try {
      const res = await fetch(`${LATEST_JSON_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LatestManifest = await res.json();
      const file = data.releaseFile;
      if (file) {
        const url = `${GITHUB_RELEASES_BASE}/${file}`;
        setApkUrl(url);
      }
      if (data.signatureChecksum) {
        setChecksum(data.signatureChecksum);
      }
      if (data.version) setLatestVersion(data.version);
      if (!silent) {
        toast({
          title: "Versão mais recente carregada",
          description: data.version ? `v${data.version}` : "latest.json carregado do GitHub",
        });
      }
    } catch (err) {
      if (!silent) {
        toast({
          title: "Falha ao buscar latest.json",
          description: String(err),
          variant: "destructive",
        });
      }
    } finally {
      setLoadingLatest(false);
    }
  };

  useEffect(() => {
    fetchLatest(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [ssid, setSsid] = useState("Rangel");
  const [password, setPassword] = useState("211292abc");
  const [touched, setTouched] = useState({
    checksum: false,
    ssid: false,
    password: false,
  });
  const restoreDefaultChecksum = () => {
    setChecksum(DEFAULT_SIGNATURE_CHECKSUM);
    setTouched((p) => ({ ...p, checksum: true }));
    toast({ title: "Checksum restaurado", description: DEFAULT_SIGNATURE_CHECKSUM });
  };

  // Validate fields
  const errors = useMemo(() => {
    return {
      checksum: !isValidChecksum(checksum),
      ssid: !isValidSsid(ssid),
      password: !isValidWifiPassword(password),
    };
  }, [checksum, ssid, password]);

  const allValid = !errors.checksum && !errors.ssid && !errors.password;

  const json = useMemo(() => {
    if (!allValid) return "";
    const obj: Record<string, unknown> = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": component,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
        apkUrl,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": checksum,
      "android.app.extra.PROVISIONING_WIFI_SSID": ssid,
      "android.app.extra.PROVISIONING_WIFI_PASSWORD": password,
      "android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE": "WPA",
      // Mantém a câmera habilitada após o provisionamento como Device Owner.
      // O AdminReceiver do Amarok lê este bundle e respeita as flags.
      "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
        keep_camera_enabled: true,
        disable_camera: false,
      },
    };
    return JSON.stringify(obj);
  }, [component, apkUrl, checksum, ssid, password, allValid]);

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
          <div className="space-y-2">
            <Label htmlFor="apkUrl">URL pública do APK</Label>
            <Input
              id="apkUrl"
              value={apkUrl}
              onChange={(e) => setApkUrl(e.target.value)}
              placeholder="https://seu-dominio/app-admin.apk"
            />
            <p className="text-xs text-muted-foreground">
              O tablet baixa o APK desta URL durante o provisionamento. Deve ser HTTPS e estar acessível publicamente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={downloadAndVerify}
              disabled={verifyStatus === "downloading" || verifyStatus === "verifying"}
            >
              {verifyStatus === "downloading" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Baixando... {verifyProgress > 0 ? `${verifyProgress}%` : ""}</>
              ) : verifyStatus === "verifying" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando SHA-256...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Baixar e verificar APK</>
              )}
            </Button>
            {verifyStatus === "ok" && apkBlobUrl && (
              <Button asChild variant="default">
                <a href={apkBlobUrl} download={apkFileName}>
                  <ShieldCheck className="w-4 h-4 mr-2" /> Salvar APK verificado para instalar
                </a>
              </Button>
            )}
            <Button onClick={() => fetchLatest(false)} variant="secondary" disabled={loadingLatest}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingLatest ? "animate-spin" : ""}`} />
              {loadingLatest ? "Buscando..." : "Buscar versão mais recente"}
            </Button>
            <Button onClick={restoreDefaultChecksum} variant="secondary">
              Restaurar checksum oficial
            </Button>
          </div>

          {verifyStatus === "ok" && (
            <Alert className="border-green-500/50 text-green-700 dark:text-green-400 [&>svg]:text-green-600">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>APK verificado com sucesso</AlertTitle>
              <AlertDescription className="space-y-1">
                <p>A soma de verificação SHA-256 confere com o valor oficial. É seguro instalar.</p>
                <p className="font-mono text-[10px] break-all opacity-80">SHA-256: {actualSha}</p>
              </AlertDescription>
            </Alert>
          )}

          {verifyStatus === "error" && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Falha na verificação — não instale o APK</AlertTitle>
              <AlertDescription className="space-y-1">
                <p>{verifyError}</p>
                {expectedSha && (
                  <p className="font-mono text-[10px] break-all">Esperado: {expectedSha}</p>
                )}
                {actualSha && (
                  <p className="font-mono text-[10px] break-all">Obtido:   {actualSha}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {latestVersion && (
            <p className="text-xs text-muted-foreground">
              Versão atual no GitHub: <span className="font-mono">v{latestVersion}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            O APK e o <span className="font-mono">latest.json</span> são lidos do repositório{" "}
            <a
              href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/tree/${GITHUB_BRANCH}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {GITHUB_OWNER}/{GITHUB_REPO}/releases
            </a>
            . Para publicar nova versão, faça commit do novo APK e atualize o <span className="font-mono">latest.json</span> (campo <span className="font-mono">releaseFile</span>) na branch <span className="font-mono">{GITHUB_BRANCH}</span>.
          </p>
          <p className="text-xs text-muted-foreground">
            Este QR usa o checksum da <strong>assinatura</strong> do APK (constante entre builds com a mesma chave), não o SHA-256 do arquivo.
            Se trocar a chave de assinatura, adicione o campo <span className="font-mono">signatureChecksum</span> no <span className="font-mono">latest.json</span>.
          </p>
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
                Checksum Base64
              </Label>
              <Input
                id="checksum"
                value={checksum}
                onChange={(e) => {
                  setChecksum(e.target.value.trim());
                  setTouched((prev) => ({ ...prev, checksum: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, checksum: true }))}
                placeholder="Checksum da assinatura em Base64 URL-safe"
                className={touched.checksum && errors.checksum ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {touched.checksum && errors.checksum && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  O checksum deve ser Base64 URL-safe com 43 caracteres.
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
