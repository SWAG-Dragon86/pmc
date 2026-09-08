package cn.pmc.calculator.probe;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

/** Installed on the test emulator only; never bundled into the release APK. */
public final class Probe extends Instrumentation {
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    @Override public void onStart() {
        Intent intent = new Intent(Intent.ACTION_MAIN).setClassName("cn.pmc.calculator", "cn.pmc.calculator.MainActivity")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivitySync(intent);
        runOnMainSync(() -> WebView.setWebContentsDebuggingEnabled(true));
        Bundle result = new Bundle();
        result.putString("stream", "PMC_QA_READY\n");
        sendStatus(0, result);
        try { Thread.sleep(30 * 60 * 1000L); } catch (InterruptedException ignored) { }
        finish(0, result);
    }
}
