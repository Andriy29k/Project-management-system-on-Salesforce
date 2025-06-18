public with sharing class AwsUtility {

    public static String uploadObject( String base64FileData, String path, String fileName ) {
        Blob pdfBlob = EncodingUtil.base64Decode( base64FileData );
        fileName = fileName.replace( ' ', '_' );
        String encodedFileName = EncodingUtil.urlEncode( fileName , 'UTF-8' );
        HttpRequest req = new HttpRequest();
        req.setMethod('PUT');
        req.setEndpoint('callout:Amazon_S3' + path + encodedFileName );
        req.setBodyAsBlob(pdfBlob);
        //https://vacations.bachelor.work.s3.eu-north-1.amazonaws.com/vacations/icons8-location-50.png
        Http http = new Http();
        HTTPResponse res = http.send(req);

        if( res.getStatusCode() == 201 || res.getStatusCode() == 200 ) {
            return ( Test.isRunningTest() ? 'test' : 'https://vacations.bachelor.work.s3.eu-north-1.amazonaws.com' ) + path + fileName;
        } else {
            throw new IllegalArgumentException( res.getBody() );
        }
    }

    public static void deleteObject( String path, String imageUrl ) {
        String encodedFileName = EncodingUtil.urlEncode( imageUrl
                .remove( ( Test.isRunningTest() ? 'test' : 'https://vacations.bachelor.work.s3.eu-north-1.amazonaws.com') )
                .remove( path ), 'UTF-8' );
        HttpRequest req = new HttpRequest();
        req.setMethod('DELETE');
        req.setEndpoint('callout:Amazon_S3' + path + encodedFileName );


        Http http = new Http();
        HTTPResponse res = http.send(req);
        if( res.getStatusCode() != 204 ) {
            throw new IllegalArgumentException( res.getBody() );
        }
    }
}