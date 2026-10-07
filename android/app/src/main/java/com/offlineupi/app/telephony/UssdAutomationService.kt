package com.offlineupi.app.telephony

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Optional Accessibility Service that monitors carrier USSD dialog windows.
 * Can assist the user by reading the NPCI prompt text or helping pre-fill
 * phone numbers into the USSD input field.
 */
class UssdAutomationService : AccessibilityService() {

    companion object {
        private const val TAG = "UssdAutomationService"
        var lastUssdMessage: String? = null
        var isServiceRunning = false
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isServiceRunning = true
        Log.d(TAG, "USSD Automation Accessibility Service Connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val source = event.source ?: return
        val packageName = event.packageName?.toString() ?: ""

        // Common phone/telecom dialog packages: com.android.phone, com.google.android.dialer
        if (packageName.contains("phone") || packageName.contains("dialer") || packageName.contains("telephony")) {
            scanNodeTree(source)
        }
    }

    private fun scanNodeTree(node: AccessibilityNodeInfo) {
        val text = node.text?.toString()
        if (!text.isNullOrBlank()) {
            if (text.contains("*99#") || text.contains("Send Money") || text.contains("UPI")) {
                lastUssdMessage = text
                Log.d(TAG, "Captured USSD Dialog text: $text")
            }
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i)
            if (child != null) {
                scanNodeTree(child)
            }
        }
    }

    override fun onInterrupt() {
        isServiceRunning = false
        Log.d(TAG, "USSD Automation Service Interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
    }
}
