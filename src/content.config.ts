import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Projects: rich metadata, drives the projects finder + project window.
const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z.object({
    id: z.string().optional(),
    year: z.union([z.number(), z.string()]).optional(),
    blurb: z.string().optional(),
    role: z.string().optional(),
    tags: z.array(z.string()).optional(),
    status: z.string().optional(),
    links: z
      .array(
        z.object({
          kind: z.string(),
          label: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
    hero: z
      .object({
        src: z.string(),
        alt: z.string().optional(),
      })
      .optional(),
    modified: z.string().optional(),
    name: z.string().optional(),
  }),
});

// Blog posts: lighter shape; `published: false` hides drafts.
const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().optional(),
    date: z.string().optional(),
    desc: z.string().optional(),
    modified: z.string().optional(),
    published: z.boolean().optional().default(true),
    hero: z
      .object({
        src: z.string().optional(),
        id: z.string().optional(),
        placeholder: z.string().optional(),
      })
      .optional(),
  }),
});

// Standalone pages (about, contact).
const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string().optional(),
    modified: z.string().optional(),
    email: z.string().optional(),
    github: z.string().optional(),
    linkedin: z.string().optional(),
  }),
});

export const collections = { projects, blog, pages };
