package com.offlineupi.app.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.offlineupi.app.data.OfflineBeneficiary
import com.offlineupi.app.data.OfflineStorage
import com.offlineupi.app.telephony.UssdController
import com.offlineupi.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen() {
    val context = LocalContext.current
    val storage = remember { OfflineStorage(context) }
    var beneficiaries by remember { mutableStateOf(storage.getBeneficiaries()) }
    var customMmi by remember { mutableStateOf("*99#") }
    var showAddDialog by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = DarkBackground,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Offline UPI", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Color.White)
                        Text("NPCI *99# NUUP & 123PAY", fontSize = 11.sp, color = EmeraldPrimary)
                    }
                },
                actions = {
                    Surface(
                        color = EmeraldDark.copy(alpha = 0.3f),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.padding(end = 12.dp)
                    ) {
                        Text(
                            text = "📶 0 KB DATA",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = EmeraldPrimary,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkSurface)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = EmeraldPrimary,
                contentColor = Color.Black
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Contact")
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item { Spacer(modifier = Modifier.height(4.dp)) }

            // 1. Bank Card
            item {
                BankBalanceCard(
                    onCheckBalance = {
                        UssdController.dialUssd(context, UssdController.NPCI_USSD_CHECK_BALANCE)
                    }
                )
            }

            // 2. Primary Fast USSD Triggers
            item {
                Text(
                    text = "Quick Actions (No Internet)",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextMuted
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    QuickActionTile(
                        title = "Main *99#",
                        subtitle = "NUUP Portal",
                        icon = Icons.Default.Dialpad,
                        color = EmeraldPrimary,
                        modifier = Modifier.weight(1f),
                        onClick = { UssdController.dialUssd(context, UssdController.NPCI_USSD_MAIN) }
                    )
                    QuickActionTile(
                        title = "Send Money",
                        subtitle = "*99*1*1#",
                        icon = Icons.Default.Send,
                        color = CyanAccent,
                        modifier = Modifier.weight(1f),
                        onClick = { UssdController.dialUssd(context, UssdController.NPCI_USSD_SEND_MOBILE) }
                    )
                    QuickActionTile(
                        title = "123PAY",
                        subtitle = "Voice Call",
                        icon = Icons.Default.Call,
                        color = Color(0xFFF59E0B),
                        modifier = Modifier.weight(1f),
                        onClick = { UssdController.call123PayIvr(context) }
                    )
                }
            }

            // 3. Custom MMI Dialer Box
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("Direct MMI Execution", fontSize = 12.sp, color = TextMuted)
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = customMmi,
                                onValueChange = { customMmi = it },
                                modifier = Modifier.weight(1f),
                                textStyle = LocalTextStyle.current.copy(
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 16.sp,
                                    color = Color.White
                                ),
                                singleLine = true
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(
                                onClick = { UssdController.dialUssd(context, customMmi) },
                                colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Dial", color = Color.Black, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // 4. Beneficiaries Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Offline Beneficiaries",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextMuted
                    )
                    Text("1-Tap Pay via USSD", fontSize = 11.sp, color = EmeraldPrimary)
                }
            }

            // 5. Beneficiaries List
            items(beneficiaries) { item ->
                BeneficiaryRow(
                    beneficiary = item,
                    onPayClicked = {
                        // Copy details to clipboard to make typing into USSD instant
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("Payee", item.phoneOrUpi))
                        Toast.makeText(context, "Copied ${item.phoneOrUpi}! Dialing ${item.getUssdCode()}...", Toast.LENGTH_SHORT).show()
                        UssdController.dialUssd(context, item.getUssdCode())
                    }
                )
            }

            item { Spacer(modifier = Modifier.height(60.dp)) }
        }
    }

    if (showAddDialog) {
        AddBeneficiaryDialog(
            onDismiss = { showAddDialog = false },
            onSave = { newOne ->
                storage.saveBeneficiary(newOne)
                beneficiaries = storage.getBeneficiaries()
                showAddDialog = false
            }
        )
    }
}

@Composable
fun BankBalanceCard(onCheckBalance: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent)
    ) {
        Box(
            modifier = Modifier
                .background(
                    Brush.linearGradient(
                        colors = listOf(Color(0xFF064E3B), Color(0xFF047857))
                    )
                )
                .padding(18.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("LINKED BANK ACCOUNT", fontSize = 10.sp, letterSpacing = 1.sp, color = Color(0xFFA7F3D0))
                    Text("SIM BOUND", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = EmeraldPrimary)
                }
                Spacer(modifier = Modifier.height(10.dp))
                Text("Primary Account", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Text("State Bank of India • XX4829", fontSize = 12.sp, color = Color(0xFFD1FAE5))
                Spacer(modifier = Modifier.height(14.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Limit: ₹5,000 / txn", fontSize = 11.sp, color = Color(0xFFA7F3D0))
                    Button(
                        onClick = onCheckBalance,
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.2f)),
                        shape = RoundedCornerShape(20.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("Check Bal (*99*3#)", fontSize = 11.sp, color = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
fun QuickActionTile(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier.clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = DarkSurface)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(title, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color.White)
            Text(subtitle, fontSize = 10.sp, color = TextMuted)
        }
    }
}

@Composable
fun BeneficiaryRow(
    beneficiary: OfflineBeneficiary,
    onPayClicked: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(beneficiary.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color.White)
                Text(beneficiary.phoneOrUpi, fontSize = 12.sp, color = TextMuted, fontFamily = FontFamily.Monospace)
            }
            Button(
                onClick = onPayClicked,
                colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary.copy(alpha = 0.2f)),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Pay ₹", color = EmeraldPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
    }
}

@Composable
fun AddBeneficiaryDialog(
    onDismiss: () -> Unit,
    onSave: (OfflineBeneficiary) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var phoneOrUpi by remember { mutableStateOf("") }
    var isPhone by remember { mutableStateOf(true) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Save Offline Beneficiary") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Contact Name") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = phoneOrUpi,
                    onValueChange = { phoneOrUpi = it },
                    label = { Text("10-digit Phone or UPI ID") },
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank() && phoneOrUpi.isNotBlank()) {
                        onSave(
                            OfflineBeneficiary(
                                id = System.currentTimeMillis().toString(),
                                name = name,
                                phoneOrUpi = phoneOrUpi,
                                isPhone = !phoneOrUpi.contains("@")
                            )
                        )
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
            ) {
                Text("Save", color = Color.Black)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = TextMuted)
            }
        }
    )
}
