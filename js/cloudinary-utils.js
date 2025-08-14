// js/cloudinary-utils.js

const CLOUDINARY_CLOUD_NAME = 'dim8zh0fh';
// قم بتعيين preset مختلف لكل نوع ملف إن لزم الأمر
const CLOUDINARY_IMAGE_UPLOAD_PRESET = 'chat_app_profile_pics'; 
const CLOUDINARY_VIDEO_UPLOAD_PRESET = 'video_uploads'; // يمكنك تغيير هذا إلى preset خاص بالفيديو

/**
 * دالة لرفع ملف (صورة أو فيديو) إلى Cloudinary.
 * @param {File} file الملف المراد رفعه.
 * @param {function(number)} onProgress دالة لمعالجة تحديثات التقدم.
 * @returns {Promise<string>} رابط الملف بعد الرفع.
 */
export function uploadFileToCloudinary(file, onProgress) {
    return new Promise((resolve, reject) => {
        if (!file) {
            console.error("لم يتم تحديد ملف لرفعه.");
            return reject("لم يتم تحديد ملف.");
        }

        const formData = new FormData();
        formData.append('file', file);
        
        let resourceType;
        let uploadPreset;

        // التحقق من نوع الملف
        if (file.type.startsWith('image/')) {
            resourceType = 'image';
            uploadPreset = CLOUDINARY_IMAGE_UPLOAD_PRESET;
        } else if (file.type.startsWith('video/')) {
            resourceType = 'video';
            uploadPreset = CLOUDINARY_VIDEO_UPLOAD_PRESET;
        } else {
            return reject('نوع الملف غير مدعوم. يدعم فقط الصور والفيديوهات.');
        }

        formData.append('upload_preset', uploadPreset);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`);

        xhr.onload = () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                console.log("تم رفع الملف بنجاح:", data);
                resolve(data.secure_url);
            } else {
                const errorData = JSON.parse(xhr.responseText);
                console.error("فشل رفع الملف إلى Cloudinary:", errorData);
                reject(errorData.error ? errorData.error.message : 'فشل الرفع');
            }
        };

        xhr.onerror = () => {
            console.error("حدث خطأ أثناء الاتصال بـ Cloudinary.");
            reject("حدث خطأ في الشبكة.");
        }

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress(percentComplete);
            }
        };

        xhr.send(formData);
    });
}

// دالة لحذف صورة من Cloudinary
export async function deleteImageFromCloudinary(publicId) {
    console.warn("وظيفة حذف الصور من Cloudinary تتطلب تنفيذًا آمنًا على الخادم (backend) باستخدام التوقيع.");
    alert("وظيفة الحذف غير متاحة في الواجهة الأمامية لأسباب أمنية. الرجاء تنفيذها على الخادم.");
    return false;
}
