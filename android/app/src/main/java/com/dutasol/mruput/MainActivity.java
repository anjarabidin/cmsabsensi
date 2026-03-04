package com.dutasol.mruput;

import android.Manifest;
import android.content.pm.Packagemanager;
import android.os.Bundle;
import android.webkit.PermissionRequest;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
  private static final int CAMERA_PERMISSION_REQUEST_CODE = 4242;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Ensure runtime permissions are granted (Android 6+)
    requestCameraPermissionsIfNeeded();

    // Grant WebRTC permissions for getUserMedia() within the WebView.
    // Without this, the WebView can deny camera access even if Android permissions are granted.
    if (this.bridge != null && this.bridge.getWebView() != null) {
      this.bridge.getWebView().setWebChromeClient(
        new BridgeWebChromeClient(this.bridge) {
          @Override
          public void onPermissionRequest(final PermissionRequest request) {
            runOnUiThread(() -> {
              try {
                request.grant(request.getResources());
              } catch (Exception e) {
                request.deny();
              }
            });
          }
        }
      );
    }
  }

  private void requestCameraPermissionsIfNeeded() {
    boolean cameraGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == Packagemanager.PERMISSION_GRANTED;
    boolean audioGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == Packagemanager.PERMISSION_GRANTED;

    if (!cameraGranted || !audioGranted) {
      ActivityCompat.requestPermissions(
        this,
        new String[] { Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO },
        CAMERA_PERMISSION_REQUEST_CODE
      );
    }
  }
}
