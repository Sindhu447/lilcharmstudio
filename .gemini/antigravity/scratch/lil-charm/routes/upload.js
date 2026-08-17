const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { verifyAdmin } = require('../middleware/auth');
const { isSupabaseConfigured, supabase } = require('../database');
const path = require('path');
const fs = require('fs');

// POST: Upload single or multiple images to Supabase Storage or Local Uploads folder
router.post('/', verifyAdmin, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files provided for upload.' });
    }

    const uploadedUrls = [];

    for (const file of req.files) {
      if (isSupabaseConfigured && supabase) {
        try {
          const fileExt = path.extname(file.originalname) || '.jpg';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${fileExt}`;
          const filePath = file.path;
          const fileBuffer = fs.readFileSync(filePath);

          const { data, error } = await supabase.storage
            .from('product-images')
            .upload(fileName, fileBuffer, {
              contentType: file.mimetype,
              upsert: true
            });

          if (!error && data) {
            const { data: publicUrlData } = supabase.storage
              .from('product-images')
              .getPublicUrl(fileName);

            if (publicUrlData?.publicUrl) {
              uploadedUrls.push(publicUrlData.publicUrl);
              // Clean up local temp upload
              try { fs.unlinkSync(filePath); } catch (e) {}
              continue;
            }
          }
        } catch (supErr) {
          console.warn('Supabase storage upload error, fallback to local URL:', supErr.message);
        }
      }

      // Local upload URL fallback
      uploadedUrls.push(`/uploads/${file.filename}`);
    }

    return res.json({
      success: true,
      message: 'Product images uploaded successfully!',
      image_url: uploadedUrls[0],
      urls: uploadedUrls
    });
  } catch (err) {
    console.error('Image upload endpoint error:', err);
    res.status(500).json({ success: false, message: err.message || 'Image upload failed' });
  }
});

module.exports = router;
