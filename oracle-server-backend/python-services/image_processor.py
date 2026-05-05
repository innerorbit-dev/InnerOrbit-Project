"""
InnerOrbit Image Processing Service
Compresses and optimizes images for chat application
"""

from PIL import Image
import io
import base64
import os
from pathlib import Path

class ImageProcessor:
    """
    Handles image compression and optimization for chat messages
    """
    
    def __init__(self, max_width=1920, max_height=1080, quality=85):
        """
        Initialize image processor
        
        Args:
            max_width (int): Maximum image width
            max_height (int): Maximum image height
            quality (int): JPEG quality (1-100)
        """
        self.max_width = max_width
        self.max_height = max_height
        self.quality = quality
    
    def compress_image(self, image_path, output_path=None):
        """
        Compress and resize image
        
        Args:
            image_path (str): Path to input image
            output_path (str): Path to save compressed image (optional)
            
        Returns:
            str: Path to compressed image
        """
        try:
            # Open image
            img = Image.open(image_path)
            
            # Convert RGBA to RGB if needed
            if img.mode == 'RGBA':
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            
            # Resize if too large
            img.thumbnail((self.max_width, self.max_height), Image.Resampling.LANCZOS)
            
            # Determine output path
            if output_path is None:
                name, ext = os.path.splitext(image_path)
                output_path = f"{name}_compressed.jpg"
            
            # Save compressed image
            img.save(output_path, 'JPEG', quality=self.quality, optimize=True)
            
            # Get file sizes
            original_size = os.path.getsize(image_path)
            compressed_size = os.path.getsize(output_path)
            reduction = ((original_size - compressed_size) / original_size) * 100
            
            print(f"✅ Image compressed successfully!")
            print(f"   Original: {original_size / 1024:.2f} KB")
            print(f"   Compressed: {compressed_size / 1024:.2f} KB")
            print(f"   Reduction: {reduction:.1f}%")
            
            return output_path
            
        except Exception as e:
            print(f"❌ Error compressing image: {e}")
            return None
    
    def image_to_base64(self, image_path):
        """
        Convert image to base64 string for Firebase upload
        
        Args:
            image_path (str): Path to image
            
        Returns:
            str: Base64 encoded image
        """
        try:
            with open(image_path, 'rb') as img_file:
                img_data = img_file.read()
                base64_str = base64.b64encode(img_data).decode('utf-8')
                
            print(f"✅ Image converted to base64")
            print(f"   Size: {len(base64_str)} characters")
            
            return base64_str
            
        except Exception as e:
            print(f"❌ Error converting to base64: {e}")
            return None
    
    def base64_to_image(self, base64_str, output_path):
        """
        Convert base64 string back to image
        
        Args:
            base64_str (str): Base64 encoded image
            output_path (str): Path to save image
            
        Returns:
            str: Path to saved image
        """
        try:
            img_data = base64.b64decode(base64_str)
            
            with open(output_path, 'wb') as img_file:
                img_file.write(img_data)
            
            print(f"✅ Base64 converted to image: {output_path}")
            
            return output_path
            
        except Exception as e:
            print(f"❌ Error converting from base64: {e}")
            return None
    
    def create_thumbnail(self, image_path, thumb_size=(200, 200)):
        """
        Create thumbnail for image preview
        
        Args:
            image_path (str): Path to input image
            thumb_size (tuple): Thumbnail size (width, height)
            
        Returns:
            str: Path to thumbnail
        """
        try:
            img = Image.open(image_path)
            
            # Convert RGBA to RGB if needed
            if img.mode == 'RGBA':
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            
            # Create thumbnail
            img.thumbnail(thumb_size, Image.Resampling.LANCZOS)
            
            # Save thumbnail
            name, ext = os.path.splitext(image_path)
            thumb_path = f"{name}_thumb.jpg"
            img.save(thumb_path, 'JPEG', quality=70, optimize=True)
            
            print(f"✅ Thumbnail created: {thumb_path}")
            
            return thumb_path
            
        except Exception as e:
            print(f"❌ Error creating thumbnail: {e}")
            return None
    
    def batch_process(self, input_folder, output_folder=None):
        """
        Process multiple images in a folder
        
        Args:
            input_folder (str): Folder containing images
            output_folder (str): Folder to save processed images
            
        Returns:
            list: Paths to processed images
        """
        if output_folder is None:
            output_folder = os.path.join(input_folder, 'compressed')
        
        # Create output folder
        Path(output_folder).mkdir(parents=True, exist_ok=True)
        
        processed_images = []
        supported_formats = ['.jpg', '.jpeg', '.png', '.webp', '.bmp']
        
        print(f"\n🔄 Processing images in: {input_folder}")
        print(f"📁 Output folder: {output_folder}\n")
        
        for file in os.listdir(input_folder):
            file_path = os.path.join(input_folder, file)
            
            # Check if file is an image
            if os.path.isfile(file_path) and any(file.lower().endswith(fmt) for fmt in supported_formats):
                output_path = os.path.join(output_folder, f"compressed_{file}")
                
                compressed = self.compress_image(file_path, output_path)
                if compressed:
                    processed_images.append(compressed)
                
                print()  # Empty line for readability
        
        print(f"\n✅ Processed {len(processed_images)} images")
        
        return processed_images


def main():
    """
    Example usage and testing
    """
    print("╔════════════════════════════════════════╗")
    print("║   InnerOrbit Image Processor          ║")
    print("╚════════════════════════════════════════╝")
    print()
    
    # Initialize processor
    processor = ImageProcessor(
        max_width=1920,
        max_height=1080,
        quality=85
    )
    
    print("📋 Available Functions:")
    print("1. Compress single image")
    print("2. Convert image to base64")
    print("3. Convert base64 to image")
    print("4. Create thumbnail")
    print("5. Batch process folder")
    print()
    
    choice = input("Enter choice (1-5): ")
    
    if choice == '1':
        image_path = input("Enter image path: ")
        processor.compress_image(image_path)
    
    elif choice == '2':
        image_path = input("Enter image path: ")
        base64_str = processor.image_to_base64(image_path)
        if base64_str:
            print(f"\nBase64 string (first 100 chars):")
            print(base64_str[:100] + "...")
    
    elif choice == '3':
        base64_str = input("Enter base64 string: ")
        output_path = input("Enter output path: ")
        processor.base64_to_image(base64_str, output_path)
    
    elif choice == '4':
        image_path = input("Enter image path: ")
        processor.create_thumbnail(image_path)
    
    elif choice == '5':
        input_folder = input("Enter input folder path: ")
        processor.batch_process(input_folder)
    
    else:
        print("❌ Invalid choice")


if __name__ == "__main__":
    main()
