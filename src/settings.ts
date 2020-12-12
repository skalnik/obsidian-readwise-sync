import { PluginSettingTab, Setting } from 'obsidian';
import ObsidianReadwise from '../main';

export class ReadwiseSettings {
  token = "";
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
            console.log(`Token: ${plugin.settings}`);
          })
      });
  }
}
