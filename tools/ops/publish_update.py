# Last Updated: 2026-03-17
# Description: Script to publish application updates to Firebase Storage and update Firestore version info.
# Project Role: DevOps utility for deploying new versions to users.

import os
import sys
import json
import re
import argparse
import subprocess
from pathlib import Path

def read_json(p):
    with open(p, 'r', encoding='utf-8') as f:
        return json.load(f)

def write_json(p, data):
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def run(cmd, cwd=None):
    r = subprocess.run(cmd, cwd=cwd, shell=True)
    if r.returncode != 0:
        sys.exit(r.returncode)

def find_latest_yml(dist_dir):
    p = Path(dist_dir) / 'latest.yml'
    if not p.exists():
        sys.exit(1)
    content = p.read_text(encoding='utf-8')
    m_path = re.search(r'(?m)^path:\s*(.+)$', content)
    installer = m_path.group(1).strip() if m_path else None
    m_block = re.search(r'(?m)blockMap:\s*(.+)$', content)
    blockmap = m_block.group(1).strip() if m_block else None
    return str(p), installer, blockmap

def make_public_url(bucket, object_path):
    base = f'https://firebasestorage.googleapis.com/v0/b/{bucket}/o/'
    encoded = object_path.replace('/', '%2F')
    return f'{base}{encoded}?alt=media'

def upload_files(service_account_path, bucket_name, uploads):
    from google.cloud import storage
    client = storage.Client.from_service_account_json(service_account_path)
    bucket = client.bucket(bucket_name)
    urls = {}
    for src, dst in uploads.items():
        blob = bucket.blob(dst)
        blob.upload_from_filename(src)
        try:
            blob.make_public()
        except Exception:
            pass
        urls[dst] = make_public_url(bucket_name, dst)
    return urls

def upload_text(service_account_path, bucket_name, dst, text):
    from google.cloud import storage
    client = storage.Client.from_service_account_json(service_account_path)
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(dst)
    blob.upload_from_string(text, content_type='application/json')
    try:
        blob.make_public()
    except Exception:
        pass
    return make_public_url(bucket_name, dst)

def update_firestore(service_account_path, version, download_url, release_notes):
    from google.cloud import firestore
    db = firestore.Client.from_service_account_json(service_account_path)
    doc_ref = db.collection('app').document('version')
    payload = {'version': version, 'downloadUrl': download_url}
    if release_notes:
        payload['releaseNotes'] = release_notes
    doc_ref.set(payload)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bump', choices=['patch', 'minor', 'major'], default='patch')
    # Use relative path for service account or standard project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    parser.add_argument('--service-account', default=str(project_root / 'download-portal' / 'service-account.json'))
    parser.add_argument('--bucket', default='innerorbit-bc8ce.appspot.com')
    parser.add_argument('--release-notes', default='')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    app_dir = project_root / 'innerorbit-universal'
    dist_dir = app_dir / 'dist'
    release_dir = app_dir / 'release'
    pkg_path = app_dir / 'package.json'
    
    if not pkg_path.exists():
        print(f"Error: package.json not found at {pkg_path}")
        sys.exit(1)
        
    pkg = read_json(pkg_path)

    if not args.dry_run:
        run(f'npm run bump:{args.bump}', cwd=str(app_dir))
        run('npm run electron:build', cwd=str(app_dir))
        pkg = read_json(pkg_path)

    latest_yml_path, installer_name, blockmap_name = find_latest_yml(dist_dir)
    if not installer_name:
        sys.exit(1)
    installer_path_dist = dist_dir / installer_name
    installer_path_release = release_dir / installer_name
    if installer_path_dist.exists():
        installer_path = installer_path_dist
    else:
        installer_path = installer_path_release
    uploads = {
        str(latest_yml_path): 'updates/latest.yml',
        str(installer_path): f'updates/{installer_name}',
    }
    if blockmap_name:
        bm_path = dist_dir / blockmap_name
        if bm_path.exists():
            uploads[str(bm_path)] = f'updates/{blockmap_name}'

    if args.dry_run:
        print('version=', pkg.get('version'))
        print('latest_yml=', latest_yml_path)
        print('installer=', str(installer_path))
        if blockmap_name:
            print('blockmap=', str(dist_dir / blockmap_name))
        print('bucket=', args.bucket)
        print('service_account=', args.service_account)
        return

    urls = upload_files(args.service_account, args.bucket, uploads)
    download_url = urls.get(f'updates/{installer_name}', '')
    if args.release_notes:
        rn_url = upload_text(args.service_account, args.bucket, 'updates/release-notes.json', json.dumps({"notes": args.release_notes}))
    update_firestore(args.service_account, pkg.get('version'), download_url, args.release_notes)
    print('published_version=', pkg.get('version'))
    print('download_url=', download_url)
    print('latest_yml_url=', urls.get('updates/latest.yml', ''))

if __name__ == '__main__':
    main()
