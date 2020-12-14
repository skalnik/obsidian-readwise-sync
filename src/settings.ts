import { PluginSettingTab, Setting } from 'obsidian';
import ObsidianReadwise from '../main';

export class ReadwiseSettings {
  token = "";
  inboxDir = "Inbox";
  referencesDir = "References";
}

export class ReadwiseSettingsTab extends PluginSettingTab {
  display(): void {
    const { containerEl } = this;
    const plugin: ObsidianReadwise = (this as any).plugin;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Settings for Obsidian ← Readwise.' });

    new Setting(containerEl)
      .setName('Readwise Access Token')
      .setDesc('You can get this from https://readwise.io/access_token')
      .addText(text => {
        text.setPlaceholder('token')
          .setValue(plugin.settings.token)
          .onChange((value) => {
            plugin.settings.token = value;
            plugin.saveData(plugin.settings);
          });
      });

    new Setting(containerEl)
      .setName('Inbox Directory')
      .setDesc('Where should new highlights be created?')
      .addText(text => {
        text.setPlaceholder('Inbox/')
          .setValue(plugin.settings.inboxDir)
          .onChange((value) => {
            plugin.settings.inboxDir = value;
            plugin.saveData(plugin.settings);
          });
      });

    new Setting(containerEl)
      .setName('References Directory')
      .setDesc('Directory where highlighted books will be created to reference')
      .addText(text => {
        text.setPlaceholder('References')
          .setValue(plugin.settings.referencesDir)
          .onChange((value) => {
            plugin.settings.referencesDir = value;
            plugin.saveData(plugin.settings);
          });
      });
  }
}
