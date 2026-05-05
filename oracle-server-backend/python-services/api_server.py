"""
Flask API Server for Image Processing
Provides REST API for InnerOrbit chat image compression
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from image_processor import ImageProcessor
import os
import uuid
from pathlib import Path

app = Flask(__name__)
CORS(app)  # Enable CORS for React Native

# Create temp directories
TEMP_DIR = 'temp'
Path(TEMP_DIR).mkdir(exist_ok=True)

# Initialize processor
processor = ImageProcessor(
    max_width=1920,
    max_height=1080,
    quality=85
)

@app.route('/', methods=['GET'])
def home():
    """API information endpoint"""
    return jsonify({
        'name': 'InnerOrbit Image Processor API',
        'version': '1.0.0',
        'endpoints': {
            'process': 'POST /api/process - Compress and process image',
            'thumbnail': 'POST /api/thumbnail - Create thumbnail only',
            'health': 'GET /health - Health check'
        }
    })

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'OK',
        'service': 'Image Processor'
    })

@app.route('/api/process', methods=['POST'])
def process_image():
    """
    Process uploaded image
    Returns compressed image and thumbnail in base64
    """
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        image = request.files['image']
        
        if image.filename == '':
            return jsonify({'error': 'No image selected'}), 400
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(image.filename)[1]
        temp_path = os.path.join(TEMP_DIR, f'{file_id}{ext}')
        
        # Save uploaded image
        image.save(temp_path)
        
        # Compress image
        compressed_path = processor.compress_image(temp_path)
        
        # Create thumbnail
        thumb_path = processor.create_thumbnail(temp_path, thumb_size=(200, 200))
        
        # Convert to base64
        compressed_base64 = processor.image_to_base64(compressed_path)
        thumb_base64 = processor.image_to_base64(thumb_path)
        
        # Get file info
        original_size = os.path.getsize(temp_path)
        compressed_size = os.path.getsize(compressed_path)
        reduction = ((original_size - compressed_size) / original_size) * 100
        
        # Cleanup temp files
        os.remove(temp_path)
        os.remove(compressed_path)
        os.remove(thumb_path)
        
        return jsonify({
            'success': True,
            'compressedImage': compressed_base64,
            'thumbnail': thumb_base64,
            'stats': {
                'originalSize': original_size,
                'compressedSize': compressed_size,
                'reduction': f'{reduction:.1f}%'
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/thumbnail', methods=['POST'])
def create_thumbnail():
    """
    Create thumbnail only
    Returns thumbnail in base64
    """
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        image = request.files['image']
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(image.filename)[1]
        temp_path = os.path.join(TEMP_DIR, f'{file_id}{ext}')
        
        # Save uploaded image
        image.save(temp_path)
        
        # Create thumbnail
        thumb_path = processor.create_thumbnail(temp_path, thumb_size=(200, 200))
        
        # Convert to base64
        thumb_base64 = processor.image_to_base64(thumb_path)
        
        # Cleanup
        os.remove(temp_path)
        os.remove(thumb_path)
        
        return jsonify({
            'success': True,
            'thumbnail': thumb_base64
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print('╔════════════════════════════════════════╗')
    print('║   InnerOrbit Image Processor API      ║')
    print('╚════════════════════════════════════════╝')
    print()
    print('✅ Server starting...')
    print('🌐 API URL: http://localhost:5000')
    print('📊 Health: http://localhost:5000/health')
    print()
    
    app.run(host='0.0.0.0', port=5000, debug=True)
