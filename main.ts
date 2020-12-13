"use strict";
import { DataAdapter, Vault, Plugin } from 'obsidian';
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
    this.vault = this.app.vault;
    this.fs = this.vault.adapter;
    this.lastUpdate = new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 365).toISOString();
    this.cachedBooks = {};

    this.settings = (await this.loadData()) || new ReadwiseSettings();
    this.addSettingTab(new ReadwiseSettingsTab(this.app, this));
    this.addRibbonIcon('dice', 'Readwise', () => {
      this.readCache();
    });
  }

  async readCache(): Promise<void> {
    // 1 year ago
    this.lastUpdate = new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 365).toISOString();
    const exists = await this.fs.exists(this.cacheFilename);
    if (exists) {
      console.log("Oh hey dope, cache exists");
      const data = await this.fs.read(this.cacheFilename);
      const cache = JSON.parse(data);

      this.cachedBooks = cache.books;
      this.lastUpdate = cache.lastUpdate;
    }

    console.log(`Alright, lastUpdate: ${this.lastUpdate}`);

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
      const filename = path.join(this.settings.resourcesDir, `${normalizedTitle}.md`);
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

        this.fs.write(filename, body).then(()=> console.log(`${normalizedTitle}.md created!`));
      }
    }

    console.log("All books fetched!");
    this.fetchHighlights();
  }

  async fetchHighlights(): Promise<void> {
    const highlights = await this.client.fetchHighlights();
    for (const highlight of highlights) {
      console.log('I have a highlight, it is: ', highlight);
      const filename = path.join(this.settings.inboxDir, `${highlight.id}.md`);
      console.log('Imma save it as: ', filename);

      const exists = await this.fs.exists(filename);
      if (!exists) {
        if (highlight.highlighted_at && highlight.highlighted_at.length > 0 &&
          ((new Date(highlight.highlighted_at)) > (new Date(this.lastUpdate)))) {
          this.lastUpdate = highlight.highlighted_at;
        }

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
    console.log("All highlights fetched!");
    this.writeCache();
  }

  writeCache(): void {
    const cache = {
      books: this.cachedBooks,
      lastUpdate: this.lastUpdate,
    };

    this.fs.write(this.cacheFilename, JSON.stringify(cache)).then(()=> {
      console.log("Cache updated!");
    });
  }
}
