"""
Sync Static Assets (scripts/sync_public.py)

Copies all files from app/static/ to public/ for Vercel deployment.
"""

import os
import shutil


def sync_public():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_dir = os.path.join(base_dir, "app", "static")
    dst_dir = os.path.join(base_dir, "public")

    if not os.path.exists(src_dir):
        print(f"Source directory {src_dir} does not exist.")
        return

    print(f"Syncing {src_dir} -> {dst_dir}...")
    if os.path.exists(dst_dir):
        shutil.rmtree(dst_dir)

    shutil.copytree(src_dir, dst_dir)
    file_count = sum(len(files) for _, _, files in os.walk(dst_dir))
    print(f"Successfully copied {file_count} files to {dst_dir}.")


if __name__ == "__main__":
    sync_public()

