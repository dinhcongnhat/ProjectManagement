import { checkMinioConnection, uploadFile } from './src/services/minioService';
import * as fs from 'fs';
import * as path from 'path';

const testMinio = async () => {
    console.log('Testing MinIO connection...');
    const isConnected = await checkMinioConnection();

    if (isConnected) {
        console.log('✅ MinIO connection successful!');

        const testFileName = 'test-upload.txt';
        const testContent = 'This is a test file for MinIO upload verification.';

        // Create a temporary test file
        const tempFilePath = path.join(process.cwd(), testFileName);
        fs.writeFileSync(tempFilePath, testContent);

        try {
            console.log(`Attempting to upload '${testFileName}'...`);
            const fileStream = fs.createReadStream(tempFilePath);
            await uploadFile(testFileName, fileStream, { 'Content-Type': 'text/plain' });
            console.log('✅ File uploaded successfully!');
        } catch (error) {
            console.error('❌ File upload failed:', error);
        } finally {
            // Cleanup temp file
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }

    } else {
        console.error('❌ MinIO connection failed. Please check your configuration and ensure MinIO is running.');
    }
};

testMinio();
