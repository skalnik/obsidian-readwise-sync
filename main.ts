"use strict";
import { DataAdapter, Vault, Plugin } from 'obsidian';
import ReadwiseClient from './src/readwise';
import { ReadwiseSettings, ReadwiseSettingsTab } from './src/settings';
import * as path from 'path';

const cacheFilename = ".cache.json";
const forbiddenCharRegex = /\*|"|\\|\/|<|>|:|\||\?/g;
let books: { [id: number]: { title: string, normalizedTitle: string } } = {};
let lastUpdate = "";

export default class ObsidianReadwise extends Plugin {
  client: ReadwiseClient;
  settings: ReadwiseSettings;
  fs: DataAdapter;
  vault: Vault;

  async onload(): Promise<void> {
    this.vault = this.app.vault;
    this.fs = this.vault.adapter;

    this.settings = (await this.loadData()) || new ReadwiseSettings();
    this.addSettingTab(new ReadwiseSettingsTab(this.app, this));
    this.addRibbonIcon('dice', 'Readwise', () => {
      this.readCache();
    });
  }

  async readCache(): Promise<void> {
    const exists = await this.fs.exists(cacheFilename);
    lastUpdate = new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 365).toISOString();
    if (exists) {
      console.log("Oh hey dope, cache exists");
      const data = await this.fs.read(cacheFilename);
      const cache = JSON.parse(data);

      books = cache.books;
      lastUpdate = cache.lastUpdate;
    }

    console.log(`Alright, lastUpdate: ${lastUpdate}`);

    this.client = new ReadwiseClient(this.settings.token, lastUpdate);
    this.fetchBooks();
  }

  async fetchBooks(): Promise<void> {
    const apiBooks = await this.client.fetchBooks();

    for (const book of apiBooks) {
      const normalizedTitle = book.title.replace(forbiddenCharRegex, "-");
      books[book.id] = {
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
        let body = [`> ${highlight.text}`,
          `— [[${books[highlight.book_id].normalizedTitle}]]`
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
      books: books,
      lastUpdate: (new Date()).toISOString()
    };

    this.fs.write(cacheFilename, JSON.stringify(cache)).then(()=> {
      console.log("Cache updated!");
    });
  }
}
