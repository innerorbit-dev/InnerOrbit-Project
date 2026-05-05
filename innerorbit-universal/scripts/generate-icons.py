from PIL import Image
import os

def generate_ico(png_path, ico_path):
    img = Image.open(png_path)
    # NSIS/Windows icons typically need these sizes
    sizes = [(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)]
    img.save(ico_path, format='ICO', sizes=sizes)
    print(f"Generated {ico_path} from {png_path}")

if __name__ == "__main__":
    logo_path = "C:/InnerOrbit-Mobile-Web-App/InnerOrbit-Logo.png"
    assets_dir = "C:/InnerOrbit-Mobile-Web-App/innerorbit-universal/assets"
    
    # Generate main icon.ico
    generate_ico(logo_path, os.path.join(assets_dir, "icon.ico"))
    
    # Also ensure other PNGs are synced (redundant but safe)
    img = Image.open(logo_path)
    img.save(os.path.join(assets_dir, "icon.png"))
    img.save(os.path.join(assets_dir, "favicon.png"))
    img.save(os.path.join(assets_dir, "splash.png"))
    img.save(os.path.join(assets_dir, "adaptive-icon.png"))
    
    # Update installer assets
    build_dir = "C:/InnerOrbit-Mobile-Web-App/innerorbit-universal/build"
    img.save(os.path.join(build_dir, "installerHeader.png"))
    img.save(os.path.join(build_dir, "installerSidebar.png"))
