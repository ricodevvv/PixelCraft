import type { Metadata } from "next";
import { toMajor } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { AdminForm } from "@/components/admin/form";
import { Field, PageHeader, Panel, Toggle } from "@/components/admin/field";
import { HuePicker } from "@/components/admin/hue-picker";
import { updateSettings } from "../../actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Branding and store behavior. Changes go live right away." />
      <AdminForm action={updateSettings} submitLabel="Save settings">
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Branding">
            <div className="space-y-5">
              <Field label="Store name">
                <input name="storeName" required maxLength={40} defaultValue={settings.storeName} className="input" />
              </Field>
              <Field label="Tagline" hint="The line under the big title.">
                <input name="tagline" maxLength={200} defaultValue={settings.tagline} className="input" />
              </Field>
              <Field label="About" hint="Shown in the footer and on the home page.">
                <textarea name="about" rows={3} maxLength={500} defaultValue={settings.about} className="input resize-y" />
              </Field>
              <Field label="Announcement" hint="Optional banner above the title, like a sale.">
                <input name="announcement" maxLength={160} defaultValue={settings.announcement} className="input" />
              </Field>
              <HuePicker defaultValue={settings.accentHue} />
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel title="Server">
              <div className="space-y-5">
                <Field label="Server address" hint="Shown with a copy button. Used to ping the player count.">
                  <input name="serverAddress" maxLength={120} defaultValue={settings.serverAddress} className="input font-mono" />
                </Field>
                <Field label="Discord invite">
                  <input name="discordUrl" type="url" defaultValue={settings.discordUrl} placeholder="https://discord.gg/..." className="input" />
                </Field>
                <Toggle name="requirePremium" label="Only accept premium (Mojang) usernames" defaultChecked={settings.requirePremium} />
                <p className="-mt-2 text-xs text-faint">Bedrock names starting with a dot are always allowed.</p>
              </div>
            </Panel>

            <Panel title="Money & language">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Currency" hint="ISO code: USD, EUR, MXN...">
                  <input name="currency" required maxLength={3} defaultValue={settings.currency} className="input font-mono uppercase" />
                </Field>
                <Field label="Store language">
                  <select name="locale" defaultValue={settings.locale} className="input">
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </Field>
                <Field label="Monthly goal" hint="0 hides the goal bar.">
                  <input
                    name="monthlyGoal"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={toMajor(settings.monthlyGoal, settings.currency)}
                    className="input font-mono"
                  />
                </Field>
                <Field label="Plugin check interval" hint="Seconds, sent as next_check.">
                  <input name="checkInterval" type="number" min="5" max="3600" defaultValue={settings.checkInterval} className="input font-mono" />
                </Field>
              </div>
            </Panel>
          </div>
        </div>
      </AdminForm>
    </>
  );
}
