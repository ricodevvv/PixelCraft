import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { RefreshCw, Trash2 } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { getBaseUrl } from "@/lib/url";
import { CopyButton } from "@/components/admin/copy-button";
import { AdminForm, ConfirmButton } from "@/components/admin/form";
import { Field, PageHeader, Panel } from "@/components/admin/field";
import { createServer, deleteServer, rotateServerSecret } from "../../actions";

export const metadata: Metadata = { title: "Servers" };

function pluginConfig(id: string, group: string, url: string, secret: string) {
  return `Supervisor:
  ${id}:
    Type: PIXELBUY
    Group: '${group}'
    URL: '${url}'
    Version: 1
    Format:
      Server: '{url}/api/server/{key}'
      Order: '{url}/api/order/{key}'
    Rest:
      Check-Interval: DETECT
      Auth: HEADER
      Property: 'secret'
      Secret: '${secret}'`;
}

function lastSeen(date: Date | null) {
  if (!date) return { label: "never connected", online: false };
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const online = seconds < 180;
  if (seconds < 60) return { label: `seen ${seconds}s ago`, online };
  if (seconds < 3600) return { label: `seen ${Math.round(seconds / 60)}m ago`, online };
  if (seconds < 86400) return { label: `seen ${Math.round(seconds / 3600)}h ago`, online };
  return { label: `seen ${date.toISOString().slice(0, 10)}`, online };
}

export default async function ServersPage() {
  const [servers, baseUrl] = await Promise.all([
    getDb().select().from(schema.servers).orderBy(asc(schema.servers.createdAt)),
    getBaseUrl(),
  ]);

  return (
    <>
      <PageHeader
        title="Servers"
        description="Each Minecraft server running PixelBuy gets its own secret. It polls this store and delivers the orders of its group."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {servers.length === 0 && (
            <Panel>
              <p className="text-sm text-muted">No servers yet. Add one on the right to get its plugin config.</p>
            </Panel>
          )}
          {servers.map((server) => {
            const seen = lastSeen(server.lastSeenAt);
            const id = `store-${server.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            const config = pluginConfig(id, server.group, baseUrl, server.secret);
            return (
              <Panel
                key={server.id}
                title={server.name}
                actions={
                  <span className={`flex items-center gap-2 text-xs ${seen.online ? "text-accent" : "text-faint"}`}>
                    <span className={`size-2 ${seen.online ? "bg-accent" : "bg-faint"}`} />
                    {seen.label}
                  </span>
                }
              >
                <p className="text-sm text-muted">
                  Group <span className="font-mono text-text">{server.group}</span>. Paste this into{" "}
                  <span className="font-mono">plugins/PixelBuy/store.yml</span>, set <span className="font-mono">Options.Supervisor</span> to{" "}
                  <span className="font-mono">{id}</span> and run <span className="font-mono">/pixelbuy reload</span>.
                </p>
                <pre className="pixel-clip mt-4 overflow-x-auto bg-bg-2 p-4 font-mono text-xs leading-relaxed text-muted [--step:3px]">
                  {config}
                </pre>
                <div className="mt-4 flex flex-wrap gap-2">
                  <CopyButton value={config} label="Copy config" />
                  <CopyButton value={server.secret} label="Copy secret" />
                  <form action={rotateServerSecret}>
                    <input type="hidden" name="id" value={server.id} />
                    <ConfirmButton message="Generate a new secret? The old one stops working right away.">
                      <RefreshCw className="size-3.5" /> New secret
                    </ConfirmButton>
                  </form>
                  <form action={deleteServer} className="ml-auto">
                    <input type="hidden" name="id" value={server.id} />
                    <ConfirmButton message={`Remove ${server.name}?`} className="btn btn-danger btn-sm">
                      <Trash2 className="size-3.5" /> Remove
                    </ConfirmButton>
                  </form>
                </div>
              </Panel>
            );
          })}
        </div>

        <Panel title="Add server" className="h-fit">
          <AdminForm action={createServer} submitLabel="Add server">
            <div className="space-y-4">
              <Field label="Name">
                <input name="name" required placeholder="Survival" className="input" />
              </Field>
              <Field label="Group" hint="Same as Options.Group in the plugin's store.yml. Products are delivered by group.">
                <input name="group" required placeholder="survival" className="input font-mono" />
              </Field>
            </div>
          </AdminForm>
        </Panel>
      </div>
    </>
  );
}
