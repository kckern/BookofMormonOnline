import { Request, Response } from 'express';

export const handleAssetlinks = (req: Request, res: Response): void => {
    res.setHeader("Content-Type", "application/json");
    
    // Get Android app certificate fingerprint from environment
    const androidCertFingerprint = process.env.ANDROID_CERT_FINGERPRINT || null;
    
    const assetlinks = [{
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
            "namespace": "android_app",
            "package_name": "online.bookofmormon.twa",
            "sha256_cert_fingerprints": [androidCertFingerprint]
        }
    }];
    
    res.json(assetlinks);
};
