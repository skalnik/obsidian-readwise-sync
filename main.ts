"use strict";
import { Notice, DataAdapter, Vault, Plugin } from 'obsidian';
import ReadwiseClient from './src/readwise';
import { ReadwiseSettings, ReadwiseSettingsTab } from './src/settings';
import * as path from 'path';

type BookCache = {
  [id: number]: {
    title: string;
    normalizedTitle: string;
  }
};

export default class ObsidianReadwise extends Plugin {
  cacheFilename = ".cache.json";
  forbiddenCharRegex = /\*|"|\\|\/|<|>|:|\||\?/g;

  client: ReadwiseClient;
  settings: ReadwiseSettings;
  fs: DataAdapter;
  vault: Vault;
  lastUpdate: string;
  cachedBooks: BookCache;

  async onload(): Promise<void> {
    this.settings = (await this.loadData()) || new ReadwiseSettings();
    this.addSettingTab(new ReadwiseSettingsTab(this.app, this));
    this.addCommand({
      id: 'readwise-sync',
      name: 'Sync Readwise highlights',
      callback: async () => this.syncNotes()
    });
  }

  syncNotes(): void {
    this.vault = this.app.vault;
    this.fs = this.vault.adapter;
    this.lastUpdate = new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 365).toISOString();
    this.cachedBooks = {};

    this.readCache();
  }

  async readCache(): Promise<void> {
    // 1 year ago
    this.lastUpdate = new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 365).toISOString();
    const exists = await this.fs.exists(this.cacheFilename);
    if (exists) {
      const data = await this.fs.read(this.cacheFilename);
      const cache = JSON.parse(data);

      this.cachedBooks = cache.books;
      this.lastUpdate = cache.lastUpdate;
    }

    this.client = new ReadwiseClient(this.settings.token, this.lastUpdate);
    this.fetchBooks();
  }

  async fetchBooks(): Promise<void> {
    const apiBooks = await this.client.fetchBooks();

    for (const book of apiBooks) {
      const normalizedTitle = book.title.replace(this.forbiddenCharRegex, "-");
      this.cachedBooks[book.id] = {
        title: book.title,
        normalizedTitle: normalizedTitle
      };
      const filename = path.join(this.settings.referencesDir, `${normalizedTitle}.md`);
      const exists = await this.fs.exists(filename);
      if (!exists) {
        const body = ['---',
          'tags: book',
          '---',
          '',
          `**Title**: ${book.title}`,
          `**Author**: [[${book.author}]]`,
          `**ISBN**: `,
          `**Read**: [[]]`,
        ].join("\n");

        this.fs.write(filename, body).then(()=> {
          console.log(`${normalizedTitle}.md created!`);
        });
      }
    }

    console.log("All books fetched!");
    this.fetchHighlights();
  }

  async fetchHighlights(): Promise<void> {
    const highlights = await this.client.fetchHighlights();
    for (const highlight of highlights) {
      const filename = path.join(this.settings.inboxDir, `${highlight.id}.md`);

      if (highlight.highlighted_at && highlight.highlighted_at.length > 0 &&
        ((new Date(highlight.highlighted_at)) > (new Date(this.lastUpdate)))) {
        this.lastUpdate = highlight.highlighted_at;
      }

      const exists = await this.fs.exists(filename);
      if (!exists) {
        let body = [`> ${highlight.text}`,
          `— [[${this.cachedBooks[highlight.book_id].normalizedTitle}]]`
        ].join("\n");

        if (highlight.note.length > 0) {
          body += `\n\n${highlight.note}`;
        }

        this.fs.write(filename, body).then(() => {
          console.log(`${highlight.id}.md created!`);
        });
      }
    }
    new Notice('Readwise highlights synced!');
    this.writeCache();
  }

  writeCache(): void {
    const cache = {
      books: this.cachedBooks,
      lastUpdate: this.lastUpdate,
    };

    this.fs.write(this.cacheFilename, JSON.stringify(cache));
  }
}
