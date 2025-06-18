public with sharing class ProductImagesController {
    @AuraEnabled(cacheable=false)
    public static String uploadFiles( String base64String, String path, String fileName ) {
        return AwsUtility.uploadObject( base64String, path, fileName );
    }

    @AuraEnabled(cacheable=false)
    public static void deleteFile( String path, String imageUrl ) {
        AwsUtility.deleteObject( path, imageUrl );
    }
}